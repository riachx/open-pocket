from candidate_functions import search_candidate, candidate_info
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
    '''candidate_id = search_candidate('Donald Trump')
    
    if candidate_id:
        # Get detailed candidate info
        info = candidate_info(candidate_id)
        
        # Print detailed information
        print("\nDetailed Candidate Information:")
        print(f"Name: {info['name']}")
        print(f"Party: {info['party']}")
        print(f"Office: {info['office']}")
        print(f"State: {info['state']}")
        print(f"Status: {info['status']}")
        print(f"First Election Year: {info['first_election_year']}")
        print(f"Most Recent Election Year: {info['last_election_year']}")
        
        # Query contributions if you want to see them as well
        print("\nContribution Information:")
        query_contributors(candidate_id)
    else:
        print(f"No candidate found with id: {candidate_id}")'''
    