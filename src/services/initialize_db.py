import csv
import sqlite3
from collections import defaultdict

def load_headers(header_csv_path):
    """Load column headers from the CSV file"""
    with open(header_csv_path, newline='') as csvfile:
        reader = csv.reader(csvfile)
        headers = next(reader)
    return headers

def init_db():
    """Initialize the SQLite database and create necessary tables"""
    try:
        # close any existing connections
        conn = sqlite3.connect('politicaldata.db', timeout=20)
        c = conn.cursor()
        
        # drop existing tables to recreate with new schema
        c.execute('DROP TABLE IF EXISTS contributorsFromCommittees')
        c.execute('DROP TABLE IF EXISTS individualContributions')
        c.execute('DROP TABLE IF EXISTS committees')
        c.execute('DROP TABLE IF EXISTS candidateCommitteeLinks')
        
        # Create table for contributions from committees
        c.execute('''
            CREATE TABLE IF NOT EXISTS contributorsFromCommittees (
                candidate_id TEXT,
                contributor_name TEXT,
                entity_type TEXT,
                amount REAL,
                year INTEGER,
                PRIMARY KEY (candidate_id, contributor_name, year)
            )
        ''')
        
        # Create table for individual contributions (PAS2)
        c.execute('''
            CREATE TABLE IF NOT EXISTS individualContributions (
                cmte_id TEXT,
                transaction_tp TEXT,
                entity_tp TEXT,
                name TEXT,
                city TEXT,
                state TEXT,
                zip_code TEXT,
                employer TEXT,
                occupation TEXT,
                transaction_dt TEXT,
                transaction_amt REAL,
                cand_id TEXT,
                year INTEGER,
                PRIMARY KEY (cmte_id, name, transaction_dt, transaction_amt)
            )
        ''')
        
        # Create table for committees (CM)
        c.execute('''
            CREATE TABLE IF NOT EXISTS committees (
                cmte_id TEXT PRIMARY KEY,
                cmte_nm TEXT,
                tres_nm TEXT,
                cmte_city TEXT,
                cmte_st TEXT,
                cmte_zip TEXT,
                cmte_dsgn TEXT,
                cmte_tp TEXT,
                cmte_pty_affiliation TEXT,
                org_tp TEXT,
                connected_org_nm TEXT,
                cand_id TEXT,
                year INTEGER
            )
        ''')
        
        # Create table for candidate-committee linkages (CCL)
        c.execute('''
            CREATE TABLE IF NOT EXISTS candidateCommitteeLinks (
                cand_id TEXT,
                cand_election_yr INTEGER,
                fec_election_yr INTEGER,
                cmte_id TEXT,
                cmte_tp TEXT,
                cmte_dsgn TEXT,
                linkage_id TEXT,
                year INTEGER,
                PRIMARY KEY (cand_id, cmte_id, cand_election_yr)
            )
        ''')
        
        # Create indexes for faster queries
        c.execute('CREATE INDEX IF NOT EXISTS idx_candidate ON contributorsFromCommittees(candidate_id)')
        c.execute('CREATE INDEX IF NOT EXISTS idx_individual_cand ON individualContributions(cand_id)')
        c.execute('CREATE INDEX IF NOT EXISTS idx_committee_id ON committees(cmte_id)')
        c.execute('CREATE INDEX IF NOT EXISTS idx_ccl_cand ON candidateCommitteeLinks(cand_id)')
        c.execute('CREATE INDEX IF NOT EXISTS idx_ccl_cmte ON candidateCommitteeLinks(cmte_id)')

        # Create senators table
        c.execute('''
        CREATE TABLE IF NOT EXISTS senators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            state TEXT,
            party TEXT,
            chamber TEXT,
            image TEXT
        )
        ''')

        with open("../assets/data/members.csv", newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                # Adjust field names based on VoteView CSV columns
                name = row['name']  # example column name, adjust as needed
                state = row['state']
                party = row['party']
                chamber = row['chamber']
                # You can derive image filename from name or member id
                image = row['image']

                c.execute('''
                    INSERT OR IGNORE INTO senators (name, state, party, chamber, image)
                    VALUES (?, ?, ?, ?, ?)
                ''', (name, state, party, chamber, image))
        
        c.execute('''
            
            DELETE FROM senators
            WHERE rowid NOT IN (
            SELECT MIN(rowid)
            FROM senators
            GROUP BY name, state, party, chamber
            );
            
                  ''')
        
        c.execute('''DELETE FROM senators
            WHERE rowid NOT IN (
            SELECT MIN(rowid)
            FROM senators
            GROUP BY name, state
            );''')
        
        conn.commit()
        return conn
    except sqlite3.OperationalError as e:
        print(f"Database error: {e}")
        if 'conn' in locals():
            conn.close()
        raise

def load_contributions_to_db(data_path, headers, conn, years):
    """Load contributorsFromCommittees from file into SQLite database for multiple years"""
    c = conn.cursor()
    
    # Batch insert for better performance
    batch_size = 1000
    batch = []
    
    with open(data_path, 'r', encoding='utf-8') as file:
        for line in file:
            parts = line.strip().split('|')
            if len(parts) != len(headers):
                continue
                
            data = dict(zip(headers, parts))
            
            # Insert for each year in the range
            for year in years:
                batch.append((
                    data['CAND_ID'],
                    data['NAME'],
                    data['ENTITY_TP'],
                    float(data['TRANSACTION_AMT']) if data['TRANSACTION_AMT'] else 0.0,
                    year
                ))
                
                if len(batch) >= batch_size:
                    c.executemany('''
                        INSERT INTO contributorsFromCommittees (candidate_id, contributor_name, entity_type, amount, year)
                        VALUES (?, ?, ?, ?, ?)
                        ON CONFLICT(candidate_id, contributor_name, year) 
                        DO UPDATE SET amount = amount + excluded.amount
                    ''', batch)
                    batch = []
    
    # Insert any remaining records
    if batch:
        c.executemany('''
            INSERT INTO contributorsFromCommittees (candidate_id, contributor_name, entity_type, amount, year)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(candidate_id, contributor_name, year) 
            DO UPDATE SET amount = amount + excluded.amount
        ''', batch)
    
    conn.commit()

def load_individual_contributions_to_db(data_path, headers, conn, year):
    """Load individual contributions (PAS2) from file into SQLite database"""
    c = conn.cursor()
    
    batch_size = 1000
    batch = []
    
    with open(data_path, 'r', encoding='utf-8') as file:
        for line in file:
            parts = line.strip().split('|')
            if len(parts) != len(headers):
                continue
                
            data = dict(zip(headers, parts))
            try:
                amount = float(data['TRANSACTION_AMT']) if data['TRANSACTION_AMT'] else 0.0
            except ValueError:
                amount = 0.0
                
            batch.append((
                data['CMTE_ID'],
                data['TRANSACTION_TP'],
                data['ENTITY_TP'],
                data['NAME'],
                data['CITY'],
                data['STATE'],
                data['ZIP_CODE'],
                data['EMPLOYER'],
                data['OCCUPATION'],
                data['TRANSACTION_DT'],
                amount,
                data['CAND_ID'],
                year
            ))
            
            if len(batch) >= batch_size:
                c.executemany('''
                    INSERT OR IGNORE INTO individualContributions 
                    (cmte_id, transaction_tp, entity_tp, name, city, state, zip_code, 
                     employer, occupation, transaction_dt, transaction_amt, cand_id, year)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', batch)
                batch = []
    
    if batch:
        c.executemany('''
            INSERT OR IGNORE INTO individualContributions 
            (cmte_id, transaction_tp, entity_tp, name, city, state, zip_code, 
             employer, occupation, transaction_dt, transaction_amt, cand_id, year)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', batch)
    
    conn.commit()

def load_committees_to_db(data_path, headers, conn, year):
    """Load committee data (CM) from file into SQLite database"""
    c = conn.cursor()
    
    batch_size = 1000
    batch = []
    
    with open(data_path, 'r', encoding='utf-8') as file:
        for line in file:
            parts = line.strip().split('|')
            if len(parts) != len(headers):
                continue
                
            data = dict(zip(headers, parts))
            batch.append((
                data['CMTE_ID'],
                data['CMTE_NM'],
                data['TRES_NM'],
                data['CMTE_CITY'],
                data['CMTE_ST'],
                data['CMTE_ZIP'],
                data['CMTE_DSGN'],
                data['CMTE_TP'],
                data['CMTE_PTY_AFFILIATION'],
                data['ORG_TP'],
                data['CONNECTED_ORG_NM'],
                data['CAND_ID'],
                year
            ))
            
            if len(batch) >= batch_size:
                c.executemany('''
                    INSERT OR REPLACE INTO committees 
                    (cmte_id, cmte_nm, tres_nm, cmte_city, cmte_st, cmte_zip, 
                     cmte_dsgn, cmte_tp, cmte_pty_affiliation, org_tp, connected_org_nm, cand_id, year)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', batch)
                batch = []
    
    if batch:
        c.executemany('''
            INSERT OR REPLACE INTO committees 
            (cmte_id, cmte_nm, tres_nm, cmte_city, cmte_st, cmte_zip, 
             cmte_dsgn, cmte_tp, cmte_pty_affiliation, org_tp, connected_org_nm, cand_id, year)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', batch)
    
    conn.commit()

def load_candidate_committee_links_to_db(data_path, headers, conn, year):
    """Load candidate-committee linkage data (CCL) from file into SQLite database"""
    c = conn.cursor()
    
    batch_size = 1000
    batch = []
    
    with open(data_path, 'r', encoding='utf-8') as file:
        for line in file:
            parts = line.strip().split('|')
            if len(parts) != len(headers):
                continue
                
            data = dict(zip(headers, parts))
            try:
                cand_election_yr = int(data['CAND_ELECTION_YR']) if data['CAND_ELECTION_YR'] else None
                fec_election_yr = int(data['FEC_ELECTION_YR']) if data['FEC_ELECTION_YR'] else None
            except ValueError:
                cand_election_yr = None
                fec_election_yr = None
                
            batch.append((
                data['CAND_ID'],
                cand_election_yr,
                fec_election_yr,
                data['CMTE_ID'],
                data['CMTE_TP'],
                data['CMTE_DSGN'],
                data['LINKAGE_ID'],
                year
            ))
            
            if len(batch) >= batch_size:
                c.executemany('''
                    INSERT OR IGNORE INTO candidateCommitteeLinks 
                    (cand_id, cand_election_yr, fec_election_yr, cmte_id, cmte_tp, cmte_dsgn, linkage_id, year)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', batch)
                batch = []
    
    if batch:
        c.executemany('''
            INSERT OR IGNORE INTO candidateCommitteeLinks 
            (cand_id, cand_election_yr, fec_election_yr, cmte_id, cmte_tp, cmte_dsgn, linkage_id, year)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', batch)
    
    conn.commit()

if __name__ == "__main__":
    # initialize database
    conn = init_db()
    
    print("Loading Contributions from Committees data (using itpas files)...")
    # Load contributions from committees data (itpas files) - these are committee-to-candidate contributions
    pas2_headers = load_headers('../assets/data/contributions-from-committees/pas2_header_file (3).csv')
    itpas_data_files = [
        ('../assets/data/contributions-from-committees/itpas2022.txt', 2022),
        ('../assets/data/contributions-from-committees/itpas2024.txt', 2024),
        ('../assets/data/contributions-from-committees/itpas2026.txt', 2026)
    ]
    
    for file_path, year in itpas_data_files:
        print(f"Loading contributions from committees for year {year}...")
        # itpas files contain contributions FROM committees TO candidates
        load_contributions_to_db(file_path, pas2_headers, conn, [year])
    
    print("Loading Committee data...")
    # load committee data (CM)
    cm_headers = load_headers('../assets/data/committee-masters/cm_header_file.csv')
    cm_data_files = [
        ('../assets/data/committee-masters/cm22.txt', 2022),
        ('../assets/data/committee-masters/cm24.txt', 2024),
        ('../assets/data/committee-masters/cm26.txt', 2026)
    ]
    
    for file_path, year in cm_data_files:
        print(f"Loading committee data for year {year}...")
        load_committees_to_db(file_path, cm_headers, conn, year)
    
    print("Loading Candidate-Committee Linkage data...")
    # load candidate-committee linkage data (CCL)
    ccl_headers = load_headers('../assets/data/committee-linkages/ccl_header_file.csv')
    ccl_data_files = [
        ('../assets/data/committee-linkages/ccl 2.txt', 2022),
        ('../assets/data/committee-linkages/ccl 3.txt', 2024),
        ('../assets/data/committee-linkages/ccl 4.txt', 2026)
    ]
    
    for file_path, year in ccl_data_files:
        print(f"Loading candidate-committee linkage data for year {year}...")
        load_candidate_committee_links_to_db(file_path, ccl_headers, conn, year)
    
    print("Database initialization complete!")
    print("\nIMPROVEMENTS MADE:")
    print("- Organized data files into proper directories")
    print("- Replaced con-from-com files with itpas files (more complete data)")
    print("- Updated file paths to use new directory structure")
    print("- itpas files contain contributions FROM committees TO candidates")
    print("- This populates the contributorsFromCommittees table with comprehensive data")
    print("\nRun the committee_functions.py test again to see improved results!")
    
    # Close database connection
    conn.close() 