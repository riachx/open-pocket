import sqlite3
import json
from query_senators import get_senators_by_state, get_senators_by_party, get_all_senators
from candidate_functions import search_candidate

def get_db_connection():
    """Get a connection to the SQLite database with proper error handling"""
    try:
        return sqlite3.connect('politicaldata.db', timeout=20)
    except sqlite3.OperationalError as e:
        print(f"Database error: {e}")
        raise

def find_senator_contributors(senator_name, year=None, conn=None):
    """
    Find contributors for a senator by searching for their candidate ID
    and then querying the contributors table
    """
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True
    
    try:
        # First, search for the candidate ID using the senator's name
        candidate_id = search_candidate(senator_name)
        
        if not candidate_id:
            print(f"No candidate found with name: {senator_name}")
            return []
        
        # Now query the contributors table
        c = conn.cursor()
        if year:
            c.execute('''
                SELECT contributor_name, amount, year
                FROM contributorsFromCommittees
                WHERE candidate_id = ? AND year = ? AND entity_type != 'IND'
                ORDER BY amount DESC
            ''', (candidate_id, year))
        else:
            c.execute('''
                SELECT contributor_name, amount, year
                FROM contributorsFromCommittees
                WHERE candidate_id = ? AND entity_type != 'IND'
                ORDER BY year DESC, amount DESC
            ''', (candidate_id,))
        
        results = c.fetchall()
        return results
    finally:
        if should_close:
            conn.close()

def print_senator_contributors(senator_name, year=None):
    """Print contributors for a specific senator"""
    results = find_senator_contributors(senator_name, year)
    
    if not results:
        print(f"No contributors found for senator: {senator_name}")
        return
    
    print(f"\nContributors to Senator {senator_name}:")
    for contributor, amount, year in results:
        print(f"{year}: {contributor}: ${amount:,.2f}")

def analyze_senator_contributions():
    """Analyze contributions for all senators in the database"""
    senators = get_all_senators()
    conn = get_db_connection()
    
    try:
        for senator in senators:
            senator_name = senator['name']
            print(f"\nAnalyzing contributions for {senator_name} ({senator['state']})...")
            
            # Search for the candidate ID
            candidate_id = search_candidate(senator_name)
            
            if not candidate_id:
                print(f"No candidate ID found for {senator_name}")
                continue
            
            # Get total contributions by year
            c = conn.cursor()
            c.execute('''
                SELECT year, SUM(amount) as total_amount, COUNT(*) as contributor_count
                FROM contributorsFromCommittees
                WHERE candidate_id = ? AND entity_type != 'IND'
                GROUP BY year
                ORDER BY year DESC
            ''', (candidate_id,))
            
            year_results = c.fetchall()
            
            if not year_results:
                print(f"No contribution data found for {senator_name}")
                continue
            
            print(f"Contribution Summary for {senator_name}:")
            for year, total_amount, contributor_count in year_results:
                print(f"  {year}: ${total_amount:,.2f} from {contributor_count} contributors")
            
            # Get top 5 contributors
            c.execute('''
                SELECT contributor_name, SUM(amount) as total_amount
                FROM contributorsFromCommittees
                WHERE candidate_id = ? AND entity_type != 'IND'
                GROUP BY contributor_name
                ORDER BY total_amount DESC
                LIMIT 5
            ''', (candidate_id,))
            
            top_contributors = c.fetchall()
            
            if top_contributors:
                print(f"Top 5 Contributors to {senator_name}:")
                for contributor, amount in top_contributors:
                    print(f"  {contributor}: ${amount:,.2f}")
            
            print("-" * 50)
    finally:
        conn.close()

if __name__ == "__main__":
    # Example usage
    senator_name = "Angus S. King, Jr."
    print_senator_contributors(senator_name)
    
    # Example with specific year
    print_senator_contributors(senator_name, 2023)
    
    # Analyze contributions for all senators
    # Uncomment to run (this might take a while)
    # analyze_senator_contributions() 