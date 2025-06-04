# src/services/candidateFunctions.py
import sqlite3
import re
import os

def getCandidateIdByName(candidate_name):
    """
    Get a candidate's ID from the database given their name.
    
    This function implements multiple search strategies to handle different name formats:
    1. Exact match in both candidates_master and candidates tables
    2. Name format conversion (First Last <-> Last, First)
    3. Last name priority matching
    4. Partial matching with individual terms
    
    Args:
        candidate_name (str): The name of the candidate to search for.
                             Can be in formats like:
                             - "Thomas Cotton"
                             - "COTTON, THOMAS" 
                             - "Cotton"
                             
    Returns:
        str or None: The candidate ID if found, None otherwise
        
    Examples:
        >>> getCandidateIdByName('Thomas Cotton')
        'H2AR04083'
        >>> getCandidateIdByName('COTTON, THOMAS')
        'H2AR04083'
        >>> getCandidateIdByName('Cotton')
        'H4CA47127'
    """
    try:
        # Updated path to external SSD location
        db_path = '/Volumes/Extreme SSD/OpenPockets/politicaldata.db'
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Clean and normalize the input name
        candidate_name = candidate_name.strip()
        
        # Try multiple search strategies
        result = None
        
        # Strategy 1: Exact match in both tables
        for table in ['candidates_master', 'candidates']:
            cursor.execute(f'SELECT CAND_ID FROM {table} WHERE CAND_NAME = ? COLLATE NOCASE', (candidate_name,))
            result = cursor.fetchone()
            if result:
                break
        
        # Strategy 2: Try reversed name format (First Last -> Last, First)
        if not result and ' ' in candidate_name:
            name_parts = candidate_name.split()
            if len(name_parts) >= 2:
                # Convert "Thomas Cotton" to "COTTON, THOMAS"
                reversed_name = f"{name_parts[-1]}, {' '.join(name_parts[:-1])}"
                for table in ['candidates_master', 'candidates']:
                    cursor.execute(f'SELECT CAND_ID FROM {table} WHERE CAND_NAME = ? COLLATE NOCASE', (reversed_name,))
                    result = cursor.fetchone()
                    if result:
                        break
        
        # Strategy 3: Try original format (Last, First -> First Last)
        if not result and ',' in candidate_name:
            name_parts = candidate_name.split(',')
            if len(name_parts) >= 2:
                # Convert "COTTON, THOMAS" to "Thomas Cotton"
                first_name = name_parts[1].strip()
                last_name = name_parts[0].strip()
                normal_name = f"{first_name} {last_name}"
                for table in ['candidates_master', 'candidates']:
                    cursor.execute(f'SELECT CAND_ID FROM {table} WHERE CAND_NAME = ? COLLATE NOCASE', (normal_name,))
                    result = cursor.fetchone()
                    if result:
                        break
        
        # Strategy 4: Partial match with last name priority
        if not result:
            # Extract potential last name (last word if space-separated, first word if comma-separated)
            if ',' in candidate_name:
                last_name = candidate_name.split(',')[0].strip()
            else:
                last_name = candidate_name.split()[-1] if ' ' in candidate_name else candidate_name
            
            # Search for last name match first (more specific)
            for table in ['candidates_master', 'candidates']:
                cursor.execute(f'SELECT CAND_ID, CAND_NAME FROM {table} WHERE CAND_NAME LIKE ? COLLATE NOCASE ORDER BY CAND_NAME LIMIT 1', 
                              (f'{last_name},%',))
                result = cursor.fetchone()
                if result:
                    break
        
        # Strategy 5: General partial match
        if not result:
            # Try partial match with any part of the name
            search_terms = re.split(r'[,\s]+', candidate_name)
            search_terms = [term.strip() for term in search_terms if term.strip()]
            
            for term in search_terms:
                if len(term) >= 3:  # Only search for terms with 3+ characters
                    for table in ['candidates_master', 'candidates']:
                        cursor.execute(f'SELECT CAND_ID, CAND_NAME FROM {table} WHERE CAND_NAME LIKE ? COLLATE NOCASE ORDER BY CAND_NAME LIMIT 1', 
                                      (f'%{term}%',))
                        result = cursor.fetchone()
                        if result:
                            break
                    if result:
                        break
            
        conn.close()
        return result[0] if result else None
    except Exception as e:
        print(f"Error finding candidate ID: {e}")
        return None

# Example usage and testing (uncomment to test)
if __name__ == "__main__":
    # Test cases
    test_cases = [
        'Thomas Cotton',
        'Cotton', 
        'Thomas',
        'COTTON, THOMAS',
        'Steven Cotton'
    ]
    
    print("Testing getCandidateIdByName function:")
    for test_name in test_cases:
        result = getCandidateIdByName(test_name)
        print(f"  '{test_name}' -> {result}")
