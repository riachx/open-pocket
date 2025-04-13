import sqlite3
import json

def get_db_connection():
    """Get a connection to the SQLite database with proper error handling"""
    try:
        return sqlite3.connect('politicaldata.db', timeout=20)
    except sqlite3.OperationalError as e:
        print(f"Database error: {e}")
        raise

def get_all_senators(conn=None):
    """Get all senators from the database"""
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True
        
    try:
        c = conn.cursor()
        c.execute('SELECT * FROM senate ORDER BY state, name')
        senators = c.fetchall()
        
        # Convert to a list of dictionaries for easier handling
        result = []
        for senator in senators:
            result.append({
                'id': senator[0],
                'name': senator[1],
                'party': senator[2],
                'state': senator[3],
                'photoUrl': senator[4],
                'phones': json.loads(senator[5]) if senator[5] else []
            })
        
        return result
    finally:
        if should_close:
            conn.close()

def get_senators_by_state(state, conn=None):
    """Get senators for a specific state"""
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True
        
    try:
        c = conn.cursor()
        c.execute('SELECT * FROM senate WHERE state = ? ORDER BY name', (state,))
        senators = c.fetchall()
        
        # Convert to a list of dictionaries for easier handling
        result = []
        for senator in senators:
            result.append({
                'id': senator[0],
                'name': senator[1],
                'party': senator[2],
                'state': senator[3],
                'photoUrl': senator[4],
                'phones': json.loads(senator[5]) if senator[5] else []
            })
        
        return result
    finally:
        if should_close:
            conn.close()

def get_senators_by_party(party, conn=None):
    """Get senators for a specific party"""
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True
        
    try:
        c = conn.cursor()
        c.execute('SELECT * FROM senate WHERE party LIKE ? ORDER BY state, name', (f'%{party}%',))
        senators = c.fetchall()
        
        # Convert to a list of dictionaries for easier handling
        result = []
        for senator in senators:
            result.append({
                'id': senator[0],
                'name': senator[1],
                'party': senator[2],
                'state': senator[3],
                'photoUrl': senator[4],
                'phones': json.loads(senator[5]) if senator[5] else []
            })
        
        return result
    finally:
        if should_close:
            conn.close()

def print_senator_info(senator):
    """Print formatted information about a senator"""
    print(f"\nSenator: {senator['name']}")
    print(f"State: {senator['state']}")
    print(f"Party: {senator['party']}")
    if senator['phones']:
        print(f"Phone: {senator['phones'][0]}")
    if senator['photoUrl']:
        print(f"Photo URL: {senator['photoUrl']}")
    print("-" * 50)

if __name__ == "__main__":
    # Example usage
    print("All Senators:")
    senators = get_all_senators()
    for senator in senators:
        print_senator_info(senator)
    
    # Example: Get senators by state
    state = "CA"
    print(f"\nSenators from {state}:")
    state_senators = get_senators_by_state(state)
    for senator in state_senators:
        print_senator_info(senator)
    
    # Example: Get senators by party
    party = "Democratic"
    print(f"\n{party} Senators:")
    party_senators = get_senators_by_party(party)
    for senator in party_senators:
        print_senator_info(senator) 