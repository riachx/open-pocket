from candidate_functions import search_candidate
import sqlite3

def get_db_connection():
    """Get a connection to the SQLite database with proper error handling"""
    try:
        return sqlite3.connect('politicaldata.db', timeout=20)
    except sqlite3.OperationalError as e:
        print(f"Database error: {e}")
        raise

def query_contributors(candidate_id, conn=None):
    """Query contributorsFromCommittees for a specific candidate from the database"""
    if not candidate_id:
        print("No candidate ID provided")
        return
        
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True
        
    try:
        c = conn.cursor()
        c.execute('''
            SELECT contributor_name, amount, year
            FROM contributorsFromCommittees
            WHERE candidate_id = ? AND entity_type != 'IND'
            ORDER BY year DESC, amount DESC
        ''', (candidate_id,))
        
        results = c.fetchall()
        if not results:
            print(f"No contributors found for candidate ID {candidate_id}")
            return
        
        print(f"\nContributors to Candidate ID {candidate_id}:")
        for contributor, amount, year in results:
            print(f"{year}: {contributor}: ${amount:,.2f}")
            
    finally:
        if should_close:
            conn.close()

def query_contributors_by_year(candidate_id, year, conn=None):
    """Query contributors for a specific candidate and year"""
    if not candidate_id:
        print("No candidate ID provided")
        return
        
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True
        
    try:
        c = conn.cursor()
        c.execute('''
            SELECT contributor_name, amount
            FROM contributorsFromCommittees
            WHERE candidate_id = ? AND entity_type != 'IND' AND year = ?
            ORDER BY amount DESC
        ''', (candidate_id, year))
        
        results = c.fetchall()
        if not results:
            print(f"No contributors found for candidate ID {candidate_id} in year {year}")
            return
        
        print(f"\nContributors to Candidate ID {candidate_id} in {year}:")
        for contributor, amount in results:
            print(f"{contributor}: ${amount:,.2f}")
            
    finally:
        if should_close:
            conn.close()


if __name__ == "__main__":
    # Example usage
    candidate_id = search_candidate('Donald Trump')
    
    # Query all contributions
    print("\nAll contributions:")
    query_contributors(candidate_id)
    
    # Query contributions for a specific year
    #print("\nContributions for 2023:")
    #query_contributors_by_year(candidate_id, 2023)
    
    # Get total contributions by year
    #get_total_contributions_by_year(candidate_id)

