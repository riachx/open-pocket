import sqlite3
import os

def get_db_connection():
    """Get a connection to the SQLite database with proper error handling"""
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(script_dir, 'politicaldata.db')
        return sqlite3.connect(db_path, timeout=20)
    except sqlite3.OperationalError as e:
        print(f"Database error: {e}")
        raise

def get_committee_ids_for_politician(candidate_id):
    """
    Get all committee IDs associated with a politician/candidate.
    
    This function queries both the candidateCommitteeLinks table (for official linkages)
    and the committees table (for committees directly linked to candidates).
    
    Args:
        candidate_id (str): The candidate ID to search for
        
    Returns:
        list: List of tuples containing (committee_id, committee_type, designation, year, source)
              where source indicates whether the link came from 'linkage' or 'direct'
              
    Examples:
        >>> get_committee_ids_for_politician('H2AR04083')
        [('C00123456', 'P', 'A', 2024, 'linkage'), ('C00789012', 'Q', 'U', 2024, 'direct')]
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        committees = []
        
        # Strategy 1: Get committees from candidateCommitteeLinks table
        cursor.execute('''
            SELECT cmte_id, cmte_tp, cmte_dsgn, year, linkage_id
            FROM candidateCommitteeLinks
            WHERE cand_id = ?
            ORDER BY year DESC, cmte_id, linkage_id
        ''', (candidate_id,))
        
        linkage_results = cursor.fetchall()
        for cmte_id, cmte_tp, cmte_dsgn, year, linkage_id in linkage_results:
            committees.append((cmte_id, cmte_tp, cmte_dsgn, year, f'linkage-{linkage_id}'))
        
        # Strategy 2: Get committees directly linked in committees table
        cursor.execute('''
            SELECT DISTINCT cmte_id, cmte_tp, cmte_dsgn, year
            FROM committees
            WHERE cand_id = ?
            ORDER BY year DESC, cmte_id
        ''', (candidate_id,))
        
        direct_results = cursor.fetchall()
        for cmte_id, cmte_tp, cmte_dsgn, year in direct_results:
            # Avoid duplicates by checking if this committee is already in the list
            if not any(c[0] == cmte_id and c[3] == year for c in committees):
                committees.append((cmte_id, cmte_tp, cmte_dsgn, year, 'direct'))
        
        conn.close()
        return committees
        
    except Exception as e:
        print(f"Error getting committee IDs for politician: {e}")
        return []

def get_committee_details(committee_id, year=None):
    """
    Get detailed information about a committee by its ID.
    
    Args:
        committee_id (str): The committee ID to look up
        year (int, optional): Specific year to filter by. If None, returns most recent data.
        
    Returns:
        dict or None: Dictionary containing committee details:
        {
            'cmte_id': str,
            'cmte_nm': str,           # Committee name
            'cmte_dsgn': str,         # Designation (A=Authorized, P=Principal, etc.)
            'cmte_tp': str,           # Type (P=PAC, Q=Super PAC, etc.)
            'cmte_pty_affiliation': str,  # Party affiliation
            'org_tp': str,            # Organization type
            'connected_org_nm': str,  # Connected organization name
            'cmte_city': str,         # Committee city
            'cmte_st': str,           # Committee state
            'year': int,              # Year of data
            'is_pac': bool,           # Whether this is a PAC
            'is_corporate_pac': bool  # Whether this is a corporate PAC
        }
        
    Examples:
        >>> get_committee_details('C00123456')
        {'cmte_id': 'C00123456', 'cmte_nm': 'Example PAC', 'is_pac': True, ...}
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Build query based on whether year is specified
        if year:
            cursor.execute('''
                SELECT cmte_id, cmte_nm, tres_nm, cmte_city, cmte_st, cmte_zip,
                       cmte_dsgn, cmte_tp, cmte_pty_affiliation, org_tp, 
                       connected_org_nm, cand_id, year
                FROM committees
                WHERE cmte_id = ? AND year = ?
                ORDER BY year DESC
                LIMIT 1
            ''', (committee_id, year))
        else:
            cursor.execute('''
                SELECT cmte_id, cmte_nm, tres_nm, cmte_city, cmte_st, cmte_zip,
                       cmte_dsgn, cmte_tp, cmte_pty_affiliation, org_tp, 
                       connected_org_nm, cand_id, year
                FROM committees
                WHERE cmte_id = ?
                ORDER BY year DESC
                LIMIT 1
            ''', (committee_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            return None
        
        # Unpack the result
        (cmte_id, cmte_nm, tres_nm, cmte_city, cmte_st, cmte_zip,
         cmte_dsgn, cmte_tp, cmte_pty_affiliation, org_tp, 
         connected_org_nm, cand_id, year) = result
        
        # Determine if this is a PAC and if it's corporate
        is_pac = cmte_tp in ['N', 'Q', 'O', 'V', 'W']  # Common PAC types
        is_corporate_pac = (is_pac and 
                           (org_tp == 'C' or  # Corporate
                            (connected_org_nm and connected_org_nm.strip() != '')))  # Has connected org
        
        return {
            'cmte_id': cmte_id,
            'cmte_nm': cmte_nm or '',
            'tres_nm': tres_nm or '',
            'cmte_city': cmte_city or '',
            'cmte_st': cmte_st or '',
            'cmte_zip': cmte_zip or '',
            'cmte_dsgn': cmte_dsgn or '',
            'cmte_tp': cmte_tp or '',
            'cmte_pty_affiliation': cmte_pty_affiliation or '',
            'org_tp': org_tp or '',
            'connected_org_nm': connected_org_nm or '',
            'cand_id': cand_id or '',
            'year': year,
            'is_pac': is_pac,
            'is_corporate_pac': is_corporate_pac
        }
        
    except Exception as e:
        print(f"Error getting committee details: {e}")
        return None

def get_pacs_for_politician(candidate_id):
    """
    Get all PACs associated with a politician, including whether they are corporate PACs.
    
    This is a convenience function that combines get_committee_ids_for_politician
    and get_committee_details to return only PACs.
    
    Args:
        candidate_id (str): The candidate ID to search for
        
    Returns:
        list: List of dictionaries containing PAC details, filtered to only include PACs
        
    Examples:
        >>> get_pacs_for_politician('H2AR04083')
        [{'cmte_id': 'C00123456', 'cmte_nm': 'Example PAC', 'is_corporate_pac': True, ...}]
    """
    try:
        committee_ids = get_committee_ids_for_politician(candidate_id)
        pacs = []
        
        for cmte_id, cmte_tp, cmte_dsgn, year, source in committee_ids:
            details = get_committee_details(cmte_id, year)
            if details and details['is_pac']:
                details['source'] = source  # Add source information
                pacs.append(details)
        
        return pacs
        
    except Exception as e:
        print(f"Error getting PACs for politician: {e}")
        return []

def get_committee_type_description(cmte_tp):
    """
    Get a human-readable description of committee type codes.
    
    Args:
        cmte_tp (str): Committee type code
        
    Returns:
        str: Description of the committee type
    """
    type_descriptions = {
        'C': 'Communication Cost',
        'D': 'Delegate Committee',
        'E': 'Electioneering Communication',
        'H': 'House Campaign Committee',
        'I': 'Independent Expenditure (Person or Group)',
        'N': 'PAC - Nonqualified',
        'O': 'Independent Expenditure-Only (Super PACs)',
        'P': 'Presidential Campaign Committee',
        'Q': 'PAC - Qualified',
        'S': 'Senate Campaign Committee',
        'U': 'Single Candidate Independent Expenditure',
        'V': 'PAC with Non-Contribution Account - Nonqualified',
        'W': 'PAC with Non-Contribution Account - Qualified',
        'X': 'Party - Nonqualified',
        'Y': 'Party - Qualified',
        'Z': 'National Party Nonfederal Account'
    }
    return type_descriptions.get(cmte_tp, f'Unknown Type ({cmte_tp})')

def get_committee_designation_description(cmte_dsgn):
    """
    Get a human-readable description of committee designation codes.
    
    Args:
        cmte_dsgn (str): Committee designation code
        
    Returns:
        str: Description of the committee designation
    """
    designation_descriptions = {
        'A': 'Authorized by a candidate',
        'B': 'Lobbyist/Registrant PAC',
        'D': 'Leadership PAC',
        'J': 'Joint fundraising committee',
        'P': 'Principal campaign committee of a candidate',
        'U': 'Unauthorized'
    }
    return designation_descriptions.get(cmte_dsgn, f'Unknown Designation ({cmte_dsgn})')

def get_contributing_pacs_for_politician(candidate_id):
    """
    Get all PACs that have contributed to a politician, including contribution amounts.
    
    This function looks at the contributorsFromCommittees table to find committees
    that have contributed to the candidate, then gets details about those committees
    to determine which ones are PACs and whether they are corporate PACs.
    
    Args:
        candidate_id (str): The candidate ID to search for
        
    Returns:
        list: List of dictionaries containing PAC contributor details:
        {
            'cmte_id': str,
            'cmte_nm': str,
            'total_amount': float,
            'years': list,
            'contributions': list,  # List of (year, amount) tuples
            'is_corporate_pac': bool,
            'cmte_tp': str,
            'cmte_dsgn': str,
            'cmte_pty_affiliation': str,
            'connected_org_nm': str
        }
        
    Examples:
        >>> get_contributing_pacs_for_politician('H8CA05035')
        [{'cmte_id': 'C00123456', 'cmte_nm': 'Example PAC', 'total_amount': 5000.0, ...}]
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get all committee contributors to this candidate
        cursor.execute('''
            SELECT contributor_name, SUM(amount) as total_amount, 
                   GROUP_CONCAT(year || ':' || amount) as year_amounts
            FROM contributorsFromCommittees
            WHERE candidate_id = ? AND entity_type != 'IND'
            GROUP BY contributor_name
            ORDER BY total_amount DESC
        ''', (candidate_id,))
        
        contributors = cursor.fetchall()
        contributing_pacs = []
        
        for contributor_name, total_amount, year_amounts in contributors:
            # Parse year_amounts string to get individual contributions
            contributions = []
            years = []
            if year_amounts:
                for year_amount in year_amounts.split(','):
                    if ':' in year_amount:
                        year, amount = year_amount.split(':')
                        try:
                            contributions.append((int(year), float(amount)))
                            years.append(int(year))
                        except ValueError:
                            continue
            
            # Try to find committee details by searching for committee name
            # First, try to find the committee ID by name
            cursor.execute('''
                SELECT cmte_id, cmte_nm, cmte_tp, cmte_dsgn, cmte_pty_affiliation, 
                       org_tp, connected_org_nm, year
                FROM committees
                WHERE cmte_nm LIKE ? OR cmte_nm = ?
                ORDER BY year DESC
                LIMIT 1
            ''', (f'%{contributor_name}%', contributor_name))
            
            committee_info = cursor.fetchone()
            
            if committee_info:
                cmte_id, cmte_nm, cmte_tp, cmte_dsgn, cmte_pty_affiliation, org_tp, connected_org_nm, year = committee_info
                
                # Check if this is a PAC
                is_pac = cmte_tp in ['N', 'Q', 'O', 'V', 'W']
                is_corporate_pac = (is_pac and 
                                   (org_tp == 'C' or 
                                    (connected_org_nm and connected_org_nm.strip() != '')))
                
                if is_pac:  # Only include if it's actually a PAC
                    contributing_pacs.append({
                        'cmte_id': cmte_id,
                        'cmte_nm': cmte_nm or contributor_name,
                        'total_amount': total_amount,
                        'years': sorted(list(set(years))),
                        'contributions': sorted(contributions, key=lambda x: x[0]),
                        'is_corporate_pac': is_corporate_pac,
                        'cmte_tp': cmte_tp,
                        'cmte_dsgn': cmte_dsgn,
                        'cmte_pty_affiliation': cmte_pty_affiliation or '',
                        'connected_org_nm': connected_org_nm or ''
                    })
            else:
                # If we can't find committee details, but the name suggests it might be a PAC
                if any(keyword in contributor_name.upper() for keyword in ['PAC', 'COMMITTEE', 'FUND', 'ASSOCIATION']):
                    contributing_pacs.append({
                        'cmte_id': 'UNKNOWN',
                        'cmte_nm': contributor_name,
                        'total_amount': total_amount,
                        'years': sorted(list(set(years))),
                        'contributions': sorted(contributions, key=lambda x: x[0]),
                        'is_corporate_pac': False,  # Unknown, so assume not corporate
                        'cmte_tp': 'UNKNOWN',
                        'cmte_dsgn': 'UNKNOWN',
                        'cmte_pty_affiliation': '',
                        'connected_org_nm': ''
                    })
        
        conn.close()
        return contributing_pacs
        
    except Exception as e:
        print(f"Error getting contributing PACs for politician: {e}")
        return []

# Example usage and testing
if __name__ == "__main__":
    from candidate_functions import getCandidateIdByName
    
    # Test with a candidate
    test_candidate = 'Pelosi'
    candidate_id = getCandidateIdByName(test_candidate)
    
    if candidate_id:
        print(f"Testing committee functions for {test_candidate} (ID: {candidate_id})")
        
        # Test getting committee IDs
        print("\n1. Committee IDs for politician:")
        committees = get_committee_ids_for_politician(candidate_id)
        print(f"Found {len(committees)} committees:")
        for cmte_id, cmte_tp, cmte_dsgn, year, source in committees:  # Show all committees
            print(f"  {cmte_id} | Type: {cmte_tp} | Designation: {cmte_dsgn} | Year: {year} | Source: {source}")
        
        # Test getting committee details for ALL committees
        print(f"\n2. Details for all committees:")
        for i, (cmte_id, cmte_tp, cmte_dsgn, year, source) in enumerate(committees, 1):  # Show all committees
            print(f"\n  Committee {i}: {cmte_id}")
            details = get_committee_details(cmte_id, year)
            if details:
                print(f"    Name: {details['cmte_nm']}")
                print(f"    Type: {get_committee_type_description(details['cmte_tp'])}")
                print(f"    Designation: {get_committee_designation_description(details['cmte_dsgn'])}")
                print(f"    Party: {details['cmte_pty_affiliation']}")
                print(f"    State: {details['cmte_st']}")
                print(f"    Is PAC: {details['is_pac']}")
                print(f"    Is Corporate PAC: {details['is_corporate_pac']}")
                print(f"    Connected Org: {details['connected_org_nm']}")
                print(f"    Year: {details['year']}")
            else:
                print(f"    No details found for committee {cmte_id}")
        
        # Test getting PACs
        print(f"\n3. PACs for {test_candidate}:")
        pacs = get_pacs_for_politician(candidate_id)
        if pacs:
            for pac in pacs[:3]:  # Show first 3 PACs
                print(f"  {pac['cmte_nm']} ({pac['cmte_id']}) - Corporate: {pac['is_corporate_pac']}")
        else:
            print("  No PACs found for this politician")
        
        # Test getting contributing PACs
        print(f"\n4. PACs that have contributed to {test_candidate}:")
        contributing_pacs = get_contributing_pacs_for_politician(candidate_id)
        if contributing_pacs:
            for pac in contributing_pacs[:5]:  # Show first 5 contributing PACs
                print(f"  {pac['cmte_nm']} ({pac['cmte_id']})")
                print(f"    Total Amount: ${pac['total_amount']:,.2f}")
                print(f"    Corporate PAC: {pac['is_corporate_pac']}")
                print(f"    Type: {get_committee_type_description(pac['cmte_tp'])}")
                print(f"    Years: {pac['years']}")
                if pac['connected_org_nm']:
                    print(f"    Connected Org: {pac['connected_org_nm']}")
                print()
        else:
            print("  No contributing PACs found for this politician")
    else:
        print(f"No candidate found for: {test_candidate}")
