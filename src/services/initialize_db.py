import csv
import sqlite3
from collections import defaultdict
from candidate_functions import search_candidate

def load_headers(header_csv_path):
    """Load column headers from the CSV file"""
    with open(header_csv_path, newline='') as csvfile:
        reader = csv.reader(csvfile)
        headers = next(reader)
    return headers

def init_db():
    """Initialize the SQLite database and create necessary tables"""
    try:
        # Close any existing connections
        conn = sqlite3.connect('politicaldata.db', timeout=20)
        c = conn.cursor()
        
        # Drop existing table to recreate with new schema
        c.execute('DROP TABLE IF EXISTS contributorsFromCommittees')
        
        # Create table for contributions
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
        
        # Create index for faster queries
        c.execute('''
            CREATE INDEX IF NOT EXISTS idx_candidate 
            ON contributorsFromCommittees(candidate_id)
        ''')
        
        conn.commit()
        return conn
    except sqlite3.OperationalError as e:
        print(f"Database error: {e}")
        if 'conn' in locals():
            conn.close()
        raise

def load_contributions_to_db(data_path, headers, conn, year):
    """Load contributorsFromCommittees from file into SQLite database"""
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
            batch.append((
                data['CAND_ID'],
                data['NAME'],
                data['ENTITY_TP'],
                float(data['TRANSACTION_AMT']),
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

if __name__ == "__main__":
    # Initialize database
    conn = init_db()
    
    # Load data into database (only need to do this once)
    headers = load_headers('../assets/data/contributions-from-committees/con-from-com-header.csv')
    
    # Define the data files and their corresponding years
    data_files = [
        ('../assets/data/contributions-from-committees/con-from-com-21-22.txt', 2021),
        ('../assets/data/contributions-from-committees/con-from-com-23-24.txt', 2023),
        ('../assets/data/contributions-from-committees/con-from-com-25-26.txt', 2025)
    ]
    
    # Load each file with its corresponding year
    for file_path, year in data_files:
        print(f"Loading data for year {year}...")
        load_contributions_to_db(file_path, headers, conn, year)
    
    # Query contributorsFromCommittees
    #candidate_id = search_candidate('Donald Trump')
    #query_contributors(candidate_id, conn)
    
    # Close database connection
    conn.close()
