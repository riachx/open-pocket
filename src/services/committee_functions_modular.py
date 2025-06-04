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

def get_committee_info(committee_id):
    """
    Get basic information about a committee.
    
    Args:
        committee_id (str): The committee ID to look up
        
    Returns:
        dict: Committee information including name, type, and organization details
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT cmte_id, cmte_nm, cmte_tp, cmte_dsgn, cmte_pty_affiliation,
                   org_tp, connected_org_nm, cand_id
            FROM committees
            WHERE cmte_id = ?
            ORDER BY year DESC
            LIMIT 1
        ''', (committee_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            return None
            
        cmte_id, cmte_nm, cmte_tp, cmte_dsgn, cmte_pty, org_tp, connected_org, cand_id = result
        
        return {
            'committee_id': cmte_id,
            'name': cmte_nm,
            'type': cmte_tp,
            'designation': cmte_dsgn,
            'party_affiliation': cmte_pty,
            'organization_type': org_tp,
            'connected_organization': connected_org,
            'candidate_id': cand_id
        }
        
    except Exception as e:
        print(f"Error getting committee info: {e}")
        return None

def get_pac_info(committee_id):
    """
    Get PAC-specific information for a committee.
    
    Args:
        committee_id (str): The committee ID to analyze
        
    Returns:
        dict: PAC information if the committee is a PAC, None otherwise
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get committee details
        cursor.execute('''
            SELECT cmte_id, cmte_nm, cmte_tp, cmte_dsgn, cmte_pty_affiliation,
                   org_tp, connected_org_nm
            FROM committees
            WHERE cmte_id = ? AND cmte_tp IN ('N', 'Q', 'O', 'V', 'W')
            ORDER BY year DESC
            LIMIT 1
        ''', (committee_id,))
        
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return None
            
        cmte_id, cmte_nm, cmte_tp, cmte_dsgn, cmte_pty, org_tp, connected_org = result
        
        # Determine PAC characteristics
        is_corporate = org_tp == 'C' or (connected_org and connected_org.strip())
        is_super_pac = cmte_tp == 'O'
        
        pac_info = {
            'committee_id': cmte_id,
            'name': cmte_nm,
            'pac_type': cmte_tp,
            'designation': cmte_dsgn,
            'party_affiliation': cmte_pty,
            'is_corporate_pac': is_corporate,
            'is_super_pac': is_super_pac,
            'connected_organization': connected_org
        }
        
        conn.close()
        return pac_info
        
    except Exception as e:
        print(f"Error getting PAC info: {e}")
        return None

def get_connected_committees(committee_id):
    """
    Get committees that are connected to the given committee.
    
    Args:
        committee_id (str): The committee ID to find connections for
        
    Returns:
        list: List of connected committee information
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        connected_committees = []
        
        # Find committees connected through candidate relationships
        cursor.execute('''
            SELECT DISTINCT c2.cmte_id, c2.cmte_nm, c2.cmte_tp, c2.connected_org_nm
            FROM candidateCommitteeLinks ccl1
            JOIN candidateCommitteeLinks ccl2 ON ccl1.cand_id = ccl2.cand_id
            JOIN committees c2 ON ccl2.cmte_id = c2.cmte_id
            WHERE ccl1.cmte_id = ? AND ccl2.cmte_id != ?
        ''', (committee_id, committee_id))
        
        for cmte_id, cmte_nm, cmte_tp, connected_org in cursor.fetchall():
            connected_committees.append({
                'committee_id': cmte_id,
                'name': cmte_nm,
                'type': cmte_tp,
                'connected_organization': connected_org,
                'connection_type': 'candidate_relationship'
            })
        
        # Find committees with same connected organization
        cursor.execute('''
            SELECT c1.connected_org_nm FROM committees c1 
            WHERE c1.cmte_id = ? AND c1.connected_org_nm IS NOT NULL AND c1.connected_org_nm != ''
            LIMIT 1
        ''', (committee_id,))
        
        org_result = cursor.fetchone()
        if org_result and org_result[0]:
            connected_org_name = org_result[0]
            
            cursor.execute('''
                SELECT DISTINCT cmte_id, cmte_nm, cmte_tp, connected_org_nm
                FROM committees
                WHERE connected_org_nm = ? AND cmte_id != ?
            ''', (connected_org_name, committee_id))
            
            for cmte_id, cmte_nm, cmte_tp, connected_org in cursor.fetchall():
                connected_committees.append({
                    'committee_id': cmte_id,
                    'name': cmte_nm,
                    'type': cmte_tp,
                    'connected_organization': connected_org,
                    'connection_type': 'same_organization'
                })
        
        conn.close()
        return connected_committees
        
    except Exception as e:
        print(f"Error getting connected committees: {e}")
        return []

def get_politician_pacs(candidate_id):
    """
    Get all PACs connected to a specific politician.
    
    Args:
        candidate_id (str): The candidate ID to find PACs for
        
    Returns:
        list: List of PAC information connected to the politician
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        pacs = []
        
        # Get PACs directly linked to the candidate
        cursor.execute('''
            SELECT DISTINCT c.cmte_id, c.cmte_nm, c.cmte_tp, c.cmte_dsgn, 
                   c.cmte_pty_affiliation, c.org_tp, c.connected_org_nm
            FROM committees c
            JOIN candidateCommitteeLinks ccl ON c.cmte_id = ccl.cmte_id
            WHERE ccl.cand_id = ? AND c.cmte_tp IN ('N', 'Q', 'O', 'V', 'W')
        ''', (candidate_id,))
        
        for cmte_id, cmte_nm, cmte_tp, cmte_dsgn, cmte_pty, org_tp, connected_org in cursor.fetchall():
            is_corporate = org_tp == 'C' or (connected_org and connected_org.strip())
            is_super_pac = cmte_tp == 'O'
            
            pac_info = {
                'committee_id': cmte_id,
                'name': cmte_nm,
                'pac_type': cmte_tp,
                'designation': cmte_dsgn,
                'party_affiliation': cmte_pty,
                'is_corporate_pac': is_corporate,
                'is_super_pac': is_super_pac,
                'connected_organization': connected_org,
                'relationship': 'directly_linked'
            }
            
            # Get connected committees for this PAC
            pac_info['connected_committees'] = get_connected_committees(cmte_id)
            pacs.append(pac_info)
        
        # Get PACs that contributed to this candidate
        cursor.execute('''
            SELECT DISTINCT c.cmte_id, c.cmte_nm, c.cmte_tp, c.cmte_dsgn,
                   c.cmte_pty_affiliation, c.org_tp, c.connected_org_nm
            FROM committees c
            JOIN contributorsFromCommittees cfc ON c.cmte_nm = cfc.contributor_name
            WHERE cfc.candidate_id = ? AND c.cmte_tp IN ('N', 'Q', 'O', 'V', 'W')
        ''', (candidate_id,))
        
        contributing_pac_ids = set(pac['committee_id'] for pac in pacs)
        
        for cmte_id, cmte_nm, cmte_tp, cmte_dsgn, cmte_pty, org_tp, connected_org in cursor.fetchall():
            if cmte_id not in contributing_pac_ids:
                is_corporate = org_tp == 'C' or (connected_org and connected_org.strip())
                is_super_pac = cmte_tp == 'O'
                
                pac_info = {
                    'committee_id': cmte_id,
                    'name': cmte_nm,
                    'pac_type': cmte_tp,
                    'designation': cmte_dsgn,
                    'party_affiliation': cmte_pty,
                    'is_corporate_pac': is_corporate,
                    'is_super_pac': is_super_pac,
                    'connected_organization': connected_org,
                    'relationship': 'contributor'
                }
                
                # Get connected committees for this PAC
                pac_info['connected_committees'] = get_connected_committees(cmte_id)
                pacs.append(pac_info)
        
        conn.close()
        return pacs
        
    except Exception as e:
        print(f"Error getting politician PACs: {e}")
        return []

def generate_detailed_candidate_report(candidate_id):
    """
    Generate a comprehensive report combining all committee analysis functions.
    Shows detailed information about all committees, PACs, and contributions.
    
    Args:
        candidate_id (str): The candidate ID to analyze
        
    Returns:
        dict: Comprehensive report with all committee and contribution data
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        report = {
            'candidate_id': candidate_id,
            'pacs': [],
            'all_committees': [],
            'contributing_committees': [],
            'committee_linkages': [],
            'summary_stats': {}
        }
        
        # Get all PACs connected to this politician
        pacs = get_politician_pacs(candidate_id)
        report['pacs'] = pacs
        
        # Get all committee linkages
        cursor.execute('''
            SELECT DISTINCT ccl.cmte_id, ccl.cmte_tp, ccl.cmte_dsgn, ccl.linkage_id,
                   c.cmte_nm, c.cmte_pty_affiliation, c.org_tp, c.connected_org_nm
            FROM candidateCommitteeLinks ccl
            LEFT JOIN committees c ON ccl.cmte_id = c.cmte_id
            WHERE ccl.cand_id = ?
            ORDER BY ccl.cmte_id
        ''', (candidate_id,))
        
        for cmte_id, cmte_tp, cmte_dsgn, linkage_id, cmte_nm, cmte_pty, org_tp, connected_org in cursor.fetchall():
            linkage_info = {
                'committee_id': cmte_id,
                'name': cmte_nm or 'Unknown Committee',
                'type': cmte_tp,
                'designation': cmte_dsgn,
                'linkage_id': linkage_id,
                'party_affiliation': cmte_pty,
                'organization_type': org_tp,
                'connected_organization': connected_org,
                'connected_committees': get_connected_committees(cmte_id) if cmte_id else []
            }
            report['committee_linkages'].append(linkage_info)
        
        # Get all contributing committees with detailed information
        cursor.execute('''
            SELECT DISTINCT cfc.contributor_name, cfc.entity_type, 
                   SUM(cfc.amount) as total_amount,
                   GROUP_CONCAT(DISTINCT cfc.year) as years,
                   COUNT(*) as contribution_count
            FROM contributorsFromCommittees cfc
            WHERE cfc.candidate_id = ?
            GROUP BY cfc.contributor_name, cfc.entity_type
            ORDER BY total_amount DESC
        ''', (candidate_id,))
        
        for contributor_name, entity_type, total_amount, years_str, count in cursor.fetchall():
            # Try to find matching committee details
            cursor.execute('''
                SELECT cmte_id, cmte_tp, cmte_dsgn, cmte_pty_affiliation, 
                       org_tp, connected_org_nm
                FROM committees
                WHERE cmte_nm = ?
                ORDER BY year DESC
                LIMIT 1
            ''', (contributor_name,))
            
            committee_details = cursor.fetchone()
            
            contributor_info = {
                'name': contributor_name,
                'entity_type': entity_type,
                'total_amount': total_amount,
                'years': [int(y) for y in years_str.split(',') if y],
                'contribution_count': count,
                'committee_id': committee_details[0] if committee_details else None,
                'committee_type': committee_details[1] if committee_details else None,
                'designation': committee_details[2] if committee_details else None,
                'party_affiliation': committee_details[3] if committee_details else None,
                'organization_type': committee_details[4] if committee_details else None,
                'connected_organization': committee_details[5] if committee_details else None,
                'is_pac': committee_details and committee_details[1] in ('N', 'Q', 'O', 'V', 'W'),
                'is_corporate_pac': committee_details and (committee_details[4] == 'C' or (committee_details[5] and committee_details[5].strip())),
                'is_super_pac': committee_details and committee_details[1] == 'O'
            }
            
            # Get connected committees if we have a committee ID
            if contributor_info['committee_id']:
                contributor_info['connected_committees'] = get_connected_committees(contributor_info['committee_id'])
            else:
                contributor_info['connected_committees'] = []
            
            report['contributing_committees'].append(contributor_info)
        
        # Generate summary statistics
        total_contributions = sum(c['total_amount'] for c in report['contributing_committees'])
        pac_contributions = [c for c in report['contributing_committees'] if c['is_pac']]
        corporate_pac_contributions = [c for c in pac_contributions if c['is_corporate_pac']]
        super_pac_contributions = [c for c in pac_contributions if c['is_super_pac']]
        
        report['summary_stats'] = {
            'total_contributors': len(report['contributing_committees']),
            'total_contributions': total_contributions,
            'total_pacs_connected': len(report['pacs']),
            'total_committee_linkages': len(report['committee_linkages']),
            'contributing_pacs': len(pac_contributions),
            'corporate_pacs': len(corporate_pac_contributions),
            'super_pacs': len(super_pac_contributions),
            'years_with_data': sorted(list(set(year for c in report['contributing_committees'] for year in c['years'])))
        }
        
        conn.close()
        return report
        
    except Exception as e:
        print(f"Error generating detailed candidate report: {e}")
        return None

def print_detailed_candidate_report(candidate_id, politician_name=None):
    """
    Print a formatted detailed candidate committee report.
    
    Args:
        candidate_id (str): The candidate ID to analyze
        politician_name (str): Optional politician name for display
    """
    report = generate_detailed_candidate_report(candidate_id)
    if not report:
        print("Unable to generate report")
        return
    
    name_display = politician_name.upper() if politician_name else candidate_id
    print(f"=== DETAILED COMMITTEE REPORT FOR {name_display} ===")
    print(f"Candidate ID: {candidate_id}\n")
    
    # Summary Statistics
    stats = report['summary_stats']
    print("SUMMARY STATISTICS:")
    print("-" * 40)
    print(f"  Total Contributors: {stats['total_contributors']}")
    print(f"  Total Contributions: ${stats['total_contributions']:,.2f}")
    print(f"  Connected PACs: {stats['total_pacs_connected']}")
    print(f"  Committee Linkages: {stats['total_committee_linkages']}")
    print(f"  Contributing PACs: {stats['contributing_pacs']}")
    print(f"  Corporate PACs: {stats['corporate_pacs']}")
    print(f"  Super PACs: {stats['super_pacs']}")
    print(f"  Years with Data: {stats['years_with_data']}")
    print()
    
    # Connected PACs
    if report['pacs']:
        print("CONNECTED PACS:")
        print("-" * 40)
        for i, pac in enumerate(report['pacs'], 1):
            print(f"  {i}. {pac['name']}")
            print(f"     Committee ID: {pac['committee_id']}")
            print(f"     PAC Type: {pac['pac_type']}")
            print(f"     Relationship: {pac['relationship']}")
            if pac['is_corporate_pac']:
                print(f"     Corporate PAC: Yes")
            if pac['is_super_pac']:
                print(f"     Super PAC: Yes")
            if pac['connected_organization']:
                print(f"     Connected Org: {pac['connected_organization']}")
            print()
    
    # Committee Linkages
    if report['committee_linkages']:
        print("COMMITTEE LINKAGES:")
        print("-" * 40)
        for i, link in enumerate(report['committee_linkages'], 1):
            print(f"  {i}. {link['name']}")
            print(f"     Committee ID: {link['committee_id']}")
            print(f"     Type: {link['type']}")
            print(f"     Designation: {link['designation']}")
            if link['party_affiliation']:
                print(f"     Party: {link['party_affiliation']}")
            if link['connected_organization']:
                print(f"     Connected Org: {link['connected_organization']}")
            print()
    
    # All Contributing Committees
    print("ALL CONTRIBUTING COMMITTEES:")
    print("-" * 40)
    for i, contributor in enumerate(report['contributing_committees'], 1):
        print(f"  {i}. {contributor['name']}")
        print(f"     Total Amount: ${contributor['total_amount']:,.2f}")
        print(f"     Entity Type: {contributor['entity_type']}")
        print(f"     Years: {contributor['years']}")
        print(f"     Contributions: {contributor['contribution_count']}")
        
        if contributor['committee_id']:
            print(f"     Committee ID: {contributor['committee_id']}")
            print(f"     Committee Type: {contributor['committee_type']}")
            
        if contributor['is_pac']:
            print(f"     PAC: Yes")
            if contributor['is_corporate_pac']:
                print(f"     Corporate PAC: Yes")
            if contributor['is_super_pac']:
                print(f"     Super PAC: Yes")
                
        if contributor['connected_organization']:
            print(f"     Connected Org: {contributor['connected_organization']}")
            
        if contributor['connected_committees']:
            print(f"     Connected Committees ({len(contributor['connected_committees'])}):")
            for conn in contributor['connected_committees'][:3]:  # Show first 3
                print(f"       - {conn['name']} ({conn['committee_id']})")
            if len(contributor['connected_committees']) > 3:
                print(f"       ... and {len(contributor['connected_committees']) - 3} more")
        print()
    
    print("=== END DETAILED REPORT ===")

# Example usage (commented out for AI agent use):
# committee_info = get_committee_info("C00000422")
# pac_info = get_pac_info("C00000422")
# connected = get_connected_committees("C00000422")
# politician_pacs = get_politician_pacs("S4SC00240")

# Test script to demonstrate committee functionality
if __name__ == "__main__":
    from candidate_functions import getCandidateIdByName
    
    # Test with a politician name (change this to test different politicians)
    test_politician = 'Barrasso'  # Try: 'Scott', 'Warren', 'Cruz', etc.
    
    print(f"=== COMMITTEE ANALYSIS FOR {test_politician.upper()} ===")
    
    # Get candidate ID
    candidate_id = getCandidateIdByName(test_politician)
    if not candidate_id:
        print(f"No candidate found for: {test_politician}")
        exit()
    
    print(f"Candidate ID: {candidate_id}\n")
    
    # NEW: Generate detailed comprehensive report
    print("=" * 60)
    print("DETAILED COMPREHENSIVE REPORT:")
    print("=" * 60)
    print_detailed_candidate_report(candidate_id, test_politician)
    
    print("\n" + "=" * 60)
    print("MODULAR FUNCTION DEMONSTRATIONS:")
    print("=" * 60)
    
    # 1. Get all PACs connected to this politician
    print("1. PACs CONNECTED TO POLITICIAN:")
    print("-" * 40)
    pacs = get_politician_pacs(candidate_id)
    
    if not pacs:
        print("   No PACs found for this politician.")
    else:
        for i, pac in enumerate(pacs, 1):
            print(f"   {i}. {pac['name']}")
            print(f"      Committee ID: {pac['committee_id']}")
            print(f"      PAC Type: {pac['pac_type']}")
            print(f"      Relationship: {pac['relationship']}")
            
            if pac['is_corporate_pac']:
                print(f"      Corporate PAC: Yes")
            if pac['is_super_pac']:
                print(f"      Super PAC: Yes")
            if pac['connected_organization']:
                print(f"      Connected Org: {pac['connected_organization']}")
            
            # Show connected committees for this PAC
            if pac['connected_committees']:
                print(f"      Connected Committees ({len(pac['connected_committees'])}):")
                for conn in pac['connected_committees'][:3]:  # Show first 3
                    print(f"        - {conn['name']} ({conn['committee_id']})")
                    print(f"          Connection: {conn['connection_type']}")
                if len(pac['connected_committees']) > 3:
                    print(f"        ... and {len(pac['connected_committees']) - 3} more")
            print()
    
    # 2. Demonstrate individual committee lookup
    if pacs:
        print("\n2. DETAILED COMMITTEE ANALYSIS:")
        print("-" * 40)
        sample_committee_id = pacs[0]['committee_id']
        
        # Get basic committee info
        committee_info = get_committee_info(sample_committee_id)
        if committee_info:
            print(f"   Committee: {committee_info['name']}")
            print(f"   ID: {committee_info['committee_id']}")
            print(f"   Type: {committee_info['type']}")
            print(f"   Designation: {committee_info['designation']}")
            if committee_info['party_affiliation']:
                print(f"   Party: {committee_info['party_affiliation']}")
            if committee_info['connected_organization']:
                print(f"   Connected Org: {committee_info['connected_organization']}")
        
        # Get PAC-specific info
        pac_info = get_pac_info(sample_committee_id)
        if pac_info:
            print(f"\n   PAC Analysis:")
            print(f"   - Corporate PAC: {pac_info['is_corporate_pac']}")
            print(f"   - Super PAC: {pac_info['is_super_pac']}")
        
        # Get connected committees
        connected = get_connected_committees(sample_committee_id)
        if connected:
            print(f"\n   Connected Committees ({len(connected)}):")
            for conn in connected[:5]:  # Show first 5
                print(f"   - {conn['name']} ({conn['committee_id']})")
                print(f"     Connection: {conn['connection_type']}")
    
    print(f"\n=== END ANALYSIS ===") 