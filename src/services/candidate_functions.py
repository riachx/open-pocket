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
        # Get the correct path to the database fileAdd commentMore actions
        script_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(script_dir, 'politicaldata.db')
        
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

def get_politician_pacs(candidate_id):
    """
    Get all PACs and their contributions for a candidate.
    
    Args:
        candidate_id (str): The candidate's ID
        
    Returns:
        dict: Dictionary containing PACs by type with their contribution details
    """
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(script_dir, 'politicaldata.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all PAC contributions for this candidate
        cursor.execute('''
            SELECT 
                contributor_name,
                entity_type,
                amount,
                year
            FROM 
                contributorsFromCommittees
            WHERE 
                candidate_id = ? 
                AND entity_type != 'IND'
            ORDER BY 
                amount DESC
        ''', (candidate_id,))
        
        contributions = cursor.fetchall()
        
        # Group by PAC and calculate totals
        pacs = {}
        for contrib in contributions:
            name, entity_type, amount, year = contrib
            
            if name not in pacs:
                pacs[name] = {
                    'committee_id': name,  # Using name as ID since we don't have CMTE_ID
                    'name': name,
                    'pac_type': entity_type,
                    'designation': entity_type,
                    'party_affiliation': 'Unknown',
                    'is_corporate_pac': entity_type in ['CORP', 'ORG'],
                    'total_contributions': 0,
                    'years': set(),
                    'pac_category': 'other_committees'
                }
            
            pacs[name]['total_contributions'] += float(amount or 0)
            if year:
                pacs[name]['years'].add(int(year))
        
        # Convert years sets to sorted lists
        for pac in pacs.values():
            pac['years'] = sorted(list(pac['years']))
        
        # Categorize PACs
        pacs_by_type = {
            'traditional_pacs': [],
            'super_pacs': [],
            'leadership_pacs': [],
            'corporate_pacs': [],
            'other_committees': []
        }
        
        for pac in pacs.values():
            if pac['is_corporate_pac']:
                pac['pac_category'] = 'corporate_pacs'
                pacs_by_type['corporate_pacs'].append(pac)
            elif pac['pac_type'] in ['N', 'Q']:
                pac['pac_category'] = 'traditional_pacs'
                pacs_by_type['traditional_pacs'].append(pac)
            elif pac['pac_type'] == 'O':
                pac['pac_category'] = 'super_pacs'
                pacs_by_type['super_pacs'].append(pac)
            elif pac['pac_type'] in ['V', 'W']:
                pac['pac_category'] = 'leadership_pacs'
                pacs_by_type['leadership_pacs'].append(pac)
            else:
                pacs_by_type['other_committees'].append(pac)
        
        conn.close()
        return pacs_by_type
        
    except Exception as e:
        print(f"Error getting PACs: {e}")
        return None

def get_politician_total_contributions(candidate_id):
    """
    Get total contribution amounts for a candidate.
    
    Args:
        candidate_id (str): The candidate's ID
        
    Returns:
        dict: Dictionary containing total contribution amounts by type
    """
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(script_dir, 'politicaldata.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get total committee contributions
        cursor.execute('''
            SELECT SUM(amount)
            FROM contributorsFromCommittees
            WHERE candidate_id = ? AND entity_type != 'IND'
        ''', (candidate_id,))
        
        committee_total = cursor.fetchone()[0] or 0
        
        # Get total individual contributions
        cursor.execute('''
            SELECT SUM(amount)
            FROM contributorsFromCommittees
            WHERE candidate_id = ? AND entity_type = 'IND'
        ''', (candidate_id,))
        
        individual_total = cursor.fetchone()[0] or 0
        
        conn.close()
        
        return {
            'committee_contributions': float(committee_total),
            'individual_contributions': float(individual_total),
            'total_contributions': float(committee_total) + float(individual_total)
        }
        
    except Exception as e:
        print(f"Error getting contribution totals: {e}")
        return None

def get_politician_corporate_connections(candidate_id):
    """
    Get corporate connections and their contributions for a candidate.
    
    Args:
        candidate_id (str): The candidate's ID
        
    Returns:
        list: List of corporate connections with their details
    """
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(script_dir, 'politicaldata.db')
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get corporate PAC contributions
        cursor.execute('''
            SELECT 
                contributor_name,
                entity_type,
                amount,
                year
            FROM 
                contributorsFromCommittees
            WHERE 
                candidate_id = ? 
                AND entity_type IN ('CORP', 'ORG')
            ORDER BY 
                amount DESC
        ''', (candidate_id,))
        
        contributions = cursor.fetchall()
        
        # Group by company and calculate totals
        companies = {}
        for contrib in contributions:
            name, entity_type, amount, year = contrib
            
            if name not in companies:
                companies[name] = {
                    'name': name,
                    'type': 'Corporate PAC Sponsor',
                    'industry': 'Unknown',
                    'size': 'Unknown',
                    'country': 'USA',
                    'connection_type': 'PAC Contribution',
                    'total_contributions': 0
                }
            
            companies[name]['total_contributions'] += float(amount or 0)
        
        conn.close()
        
        # Convert to list and sort by contribution amount
        return sorted(
            list(companies.values()),
            key=lambda x: x['total_contributions'],
            reverse=True
        )
        
    except Exception as e:
        print(f"Error getting corporate connections: {e}")
        return None

def test_politician_functions():
    """
    Test all politician-related functions with a single test politician.
    """
    # Test with a known politician (e.g., "Thomas Cotton")
    test_name = "Thomas Cotton"
    print(f"\nTesting functions for politician: {test_name}")
    
    # Get candidate ID
    candidate_id = getCandidateIdByName(test_name)
    print(f"\nCandidate ID: {candidate_id}")
    
    if candidate_id:
        # Test PAC functions
        pacs = get_politician_pacs(candidate_id)
        print("\nPACs by type:")
        for pac_type, pac_list in pacs.items():
            print(f"\n{pac_type}:")
            for pac in pac_list[:3]:  # Show first 3 PACs of each type
                print(f"  - {pac['name']}: ${pac['total_contributions']:,.2f}")
        
        # Test total contributions
        totals = get_politician_total_contributions(candidate_id)
        print("\nTotal Contributions:")
        print(f"  Committee: ${totals['committee_contributions']:,.2f}")
        print(f"  Individual: ${totals['individual_contributions']:,.2f}")
        print(f"  Total: ${totals['total_contributions']:,.2f}")
        
        # Test corporate connections
        connections = get_politician_corporate_connections(candidate_id)
        print("\nTop Corporate Connections:")
        for company in connections[:5]:  # Show top 5 connections
            print(f"  - {company['name']}: ${company['total_contributions']:,.2f}")
    else:
        print(f"No candidate ID found for {test_name}")

if __name__ == "__main__":
    test_politician_functions()
