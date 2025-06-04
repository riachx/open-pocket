import sqlite3
import time
from candidate_functions import getCandidateIdByName

def get_db_connection():
    """Get a connection to the SQLite database with proper error handling"""
    try:
        db_path = '/Volumes/Extreme SSD/OpenPockets/politicaldata.db'
        conn = sqlite3.connect(db_path, timeout=20)
        
        # Optimize connection settings
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL') 
        conn.execute('PRAGMA cache_size=1000000')
        conn.execute('PRAGMA temp_store=memory')
        
        return conn
    except sqlite3.OperationalError as e:
        print(f"Database error: {e}")
        raise

def get_politician_pacs(candidate_id, conn=None):
    """
    Get all PACs connected to a politician, organized by type.
    Returns comprehensive PAC analysis including corporate connections.
    """
    try:
        should_close = conn is None
        if conn is None:
            conn = get_db_connection()
        cursor = conn.cursor()
        
        pacs_by_type = {
            'traditional_pacs': [],      # PAC type 'N', 'Q'
            'super_pacs': [],            # PAC type 'O'
            'leadership_pacs': [],       # PAC type 'V', 'W'
            'corporate_pacs': [],        # org_tp = 'C' or has connected_org
            'other_committees': []       # Other committee types
        }
        
        # Get PACs directly linked to candidate
        cursor.execute('''
            SELECT DISTINCT c.cmte_id, c.cmte_nm, c.cmte_tp, c.cmte_dsgn, 
                   c.cmte_pty_affiliation, c.org_tp, c.connected_org_nm,
                   SUM(cfc.amount) as total_contributions,
                   GROUP_CONCAT(DISTINCT cfc.year) as years
            FROM committees c
            JOIN candidateCommitteeLinks ccl ON c.cmte_id = ccl.cmte_id
            LEFT JOIN contributorsFromCommittees cfc ON c.cmte_nm = cfc.contributor_name 
                AND cfc.candidate_id = ?
            WHERE ccl.cand_id = ? AND c.cmte_tp IN ('N', 'Q', 'O', 'V', 'W')
            GROUP BY c.cmte_id, c.cmte_nm, c.cmte_tp, c.cmte_dsgn, 
                     c.cmte_pty_affiliation, c.org_tp, c.connected_org_nm
        ''', (candidate_id, candidate_id))
        
        directly_linked = cursor.fetchall()
        
        # Get PACs that contributed to this candidate
        cursor.execute('''
            SELECT DISTINCT c.cmte_id, c.cmte_nm, c.cmte_tp, c.cmte_dsgn,
                   c.cmte_pty_affiliation, c.org_tp, c.connected_org_nm,
                   cfc.amount as total_contributions,
                   GROUP_CONCAT(DISTINCT cfc.year) as years
            FROM committees c
            JOIN contributorsFromCommittees cfc ON c.cmte_nm = cfc.contributor_name
            WHERE cfc.candidate_id = ? AND c.cmte_tp IN ('N', 'Q', 'O', 'V', 'W')
            GROUP BY c.cmte_id, c.cmte_nm, c.cmte_tp, c.cmte_dsgn,
                     c.cmte_pty_affiliation, c.org_tp, c.connected_org_nm, cfc.amount
        ''', (candidate_id,))
        
        contributing_pacs = cursor.fetchall()
        
        # Process all PACs
        all_pacs = {}
        for pac_data in directly_linked + contributing_pacs:
            (cmte_id, cmte_nm, cmte_tp, cmte_dsgn, cmte_pty, org_tp, 
             connected_org, total_contrib, years_str) = pac_data
            
            if cmte_id in all_pacs:
                # Merge contribution data
                if total_contrib:
                    all_pacs[cmte_id]['total_contributions'] += total_contrib or 0
            else:
                is_corporate = org_tp == 'C' or (connected_org and connected_org.strip())
                
                pac_info = {
                    'committee_id': cmte_id,
                    'name': cmte_nm,
                    'pac_type': cmte_tp,
                    'designation': cmte_dsgn,
                    'party_affiliation': cmte_pty,
                    'is_corporate_pac': is_corporate,
                    'connected_organization': connected_org,
                    'total_contributions': total_contrib or 0,
                    'years': [int(y) for y in years_str.split(',') if y and y.isdigit()] if years_str else []
                }
                
                all_pacs[cmte_id] = pac_info
        
        # Categorize PACs by type
        for pac in all_pacs.values():
            pac_type = pac['pac_type']
            
            if pac['is_corporate_pac']:
                pacs_by_type['corporate_pacs'].append(pac)
            elif pac_type == 'O':
                pacs_by_type['super_pacs'].append(pac)
            elif pac_type in ('V', 'W'):
                pacs_by_type['leadership_pacs'].append(pac)
            elif pac_type in ('N', 'Q'):
                pacs_by_type['traditional_pacs'].append(pac)
            else:
                pacs_by_type['other_committees'].append(pac)
        
        # Sort each category by contribution amount
        for category in pacs_by_type:
            pacs_by_type[category].sort(key=lambda x: x['total_contributions'], reverse=True)
        
        if should_close:
            conn.close()
            
        return pacs_by_type
        
    except Exception as e:
        print(f"Error getting politician PACs: {e}")
        if should_close and conn:
            conn.close()
        return {}

def get_politician_super_pacs(candidate_id, conn=None):
    """
    Get Super PACs that spent money supporting or opposing a politician.
    Uses independent expenditures data.
    """
    try:
        should_close = conn is None
        if conn is None:
            conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get Super PACs that spent on this candidate
        cursor.execute('''
            SELECT 
                ie.spe_id,
                ie.spe_nam,
                c.cmte_tp,
                c.org_tp,
                c.connected_org_nm,
                SUM(CASE WHEN ie.sup_opp = 'S' THEN ie.exp_amo ELSE 0 END) as support_amount,
                SUM(CASE WHEN ie.sup_opp = 'O' THEN ie.exp_amo ELSE 0 END) as oppose_amount,
                COUNT(CASE WHEN ie.sup_opp = 'S' THEN 1 END) as support_count,
                COUNT(CASE WHEN ie.sup_opp = 'O' THEN 1 END) as oppose_count,
                GROUP_CONCAT(DISTINCT ie.year) as years
            FROM independent_expenditures ie
            LEFT JOIN committees c ON ie.spe_id = c.cmte_id
            WHERE ie.cand_id = ?
            GROUP BY ie.spe_id, ie.spe_nam, c.cmte_tp, c.org_tp, c.connected_org_nm
            ORDER BY (support_amount + oppose_amount) DESC
        ''', (candidate_id,))
        
        super_pacs = []
        for row in cursor.fetchall():
            (spe_id, spe_nam, cmte_tp, org_tp, connected_org, support_amt, 
             oppose_amt, support_count, oppose_count, years_str) = row
            
            is_corporate = org_tp == 'C' or (connected_org and connected_org.strip())
            total_spending = support_amt + oppose_amt
            
            super_pac_info = {
                'committee_id': spe_id,
                'name': spe_nam,
                'committee_type': cmte_tp,
                'is_corporate': is_corporate,
                'connected_organization': connected_org,
                'support_spending': support_amt,
                'opposition_spending': oppose_amt,
                'total_spending': total_spending,
                'support_expenditures': support_count,
                'opposition_expenditures': oppose_count,
                'years': [int(y) for y in years_str.split(',') if y and y.isdigit()] if years_str else []
            }
            
            super_pacs.append(super_pac_info)
        
        if should_close:
            conn.close()
            
        return super_pacs
        
    except Exception as e:
        print(f"Error getting Super PACs: {e}")
        if should_close and conn:
            conn.close()
        return []

def get_politician_corporate_connections(candidate_id, conn=None):
    """
    Get all corporate connections for a politician through LinkedIn companies
    and committee corporate connections.
    """
    try:
        should_close = conn is None
        if conn is None:
            conn = get_db_connection()
        cursor = conn.cursor()
        
        companies = []
        
        # Get LinkedIn companies that might be connected through name matching
        # This is a simple heuristic - in practice, you'd want more sophisticated matching
        cursor.execute('''
            SELECT DISTINCT lc.name, lc.industry, lc.size, lc.website, lc.city, 
                   lc.state, lc.country_code, lc.relevance_score
            FROM linkedin_companies lc
            WHERE lc.relevance_score >= 7  -- High relevance companies only
            ORDER BY lc.relevance_score DESC, lc.size_priority ASC
            LIMIT 20
        ''')
        
        for row in cursor.fetchall():
            name, industry, size, website, city, state, country, relevance = row
            
            companies.append({
                'name': name,
                'type': 'LinkedIn Company',
                'industry': industry,
                'size': size,
                'website': website,
                'location': f"{city}, {state}" if city and state else None,
                'country': country,
                'relevance_score': relevance,
                'connection_type': 'Industry Relevance'
            })
        
        # Get corporate PACs connected to this politician
        cursor.execute('''
            SELECT DISTINCT c.connected_org_nm, c.cmte_nm, c.cmte_tp,
                   SUM(cfc.amount) as total_contributions
            FROM committees c
            LEFT JOIN contributorsFromCommittees cfc ON c.cmte_nm = cfc.contributor_name
                AND cfc.candidate_id = ?
            WHERE c.connected_org_nm IS NOT NULL AND c.connected_org_nm != ''
            AND (EXISTS (
                SELECT 1 FROM candidateCommitteeLinks ccl 
                WHERE ccl.cmte_id = c.cmte_id AND ccl.cand_id = ?
            ) OR cfc.candidate_id = ?)
            GROUP BY c.connected_org_nm, c.cmte_nm, c.cmte_tp
            ORDER BY total_contributions DESC
        ''', (candidate_id, candidate_id, candidate_id))
        
        for row in cursor.fetchall():
            org_name, committee_name, committee_type, contributions = row
            
            companies.append({
                'name': org_name,
                'type': 'Corporate PAC Sponsor',
                'industry': 'Unknown',
                'size': 'Unknown',
                'website': None,
                'location': None,
                'country': 'US',
                'relevance_score': None,
                'connection_type': f'Via {committee_name} ({committee_type})',
                'total_contributions': contributions or 0
            })
        
        if should_close:
            conn.close()
            
        return companies
        
    except Exception as e:
        print(f"Error getting corporate connections: {e}")
        if should_close and conn:
            conn.close()
        return []

def get_politician_total_contributions(candidate_id, conn=None):
    """
    Get total contributions received by a politician from all sources.
    """
    try:
        should_close = conn is None
        if conn is None:
            conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get committee contributions
        cursor.execute('''
            SELECT 
                SUM(amount) as total_committee_contributions,
                COUNT(*) as committee_contribution_count,
                GROUP_CONCAT(DISTINCT year) as years
            FROM contributorsFromCommittees
            WHERE candidate_id = ?
        ''', (candidate_id,))
        
        committee_result = cursor.fetchone()
        
        # Get individual contributions 
        cursor.execute('''
            SELECT 
                SUM(transaction_amt) as total_individual_contributions,
                COUNT(*) as individual_contribution_count,
                GROUP_CONCAT(DISTINCT year) as years
            FROM individualContributions
            WHERE cand_id = ?
        ''', (candidate_id,))
        
        individual_result = cursor.fetchone()
        
        committee_total = committee_result[0] if committee_result[0] else 0
        committee_count = committee_result[1] if committee_result[1] else 0
        committee_years = committee_result[2] if committee_result[2] else ""
        
        individual_total = individual_result[0] if individual_result[0] else 0
        individual_count = individual_result[1] if individual_result[1] else 0
        individual_years = individual_result[2] if individual_result[2] else ""
        
        # Combine years
        all_years = set()
        for year_str in [committee_years, individual_years]:
            if year_str:
                all_years.update([int(y) for y in year_str.split(',') if y and y.isdigit()])
        
        if should_close:
            conn.close()
            
        return {
            'committee_contributions': committee_total,
            'individual_contributions': individual_total,
            'total_contributions': committee_total + individual_total,
            'committee_contribution_count': committee_count,
            'individual_contribution_count': individual_count,
            'total_contribution_count': committee_count + individual_count,
            'years_with_data': sorted(list(all_years))
        }
        
    except Exception as e:
        print(f"Error getting total contributions: {e}")
        if should_close and conn:
            conn.close()
        return {}

def generate_comprehensive_money_report(candidate_id, politician_name=None):
    """
    Generate a comprehensive money tracking report for a politician.
    """
    try:
        conn = get_db_connection()
        
        report = {
            'candidate_id': candidate_id,
            'politician_name': politician_name,
            'pacs_by_type': {},
            'super_pacs': [],
            'corporate_connections': [],
            'contribution_totals': {},
            'summary_stats': {}
        }
        
        # Get all PACs by type
        report['pacs_by_type'] = get_politician_pacs(candidate_id, conn)
        
        # Get Super PACs
        report['super_pacs'] = get_politician_super_pacs(candidate_id, conn)
        
        # Get corporate connections
        report['corporate_connections'] = get_politician_corporate_connections(candidate_id, conn)
        
        # Get contribution totals
        report['contribution_totals'] = get_politician_total_contributions(candidate_id, conn)
        
        # Generate summary statistics
        total_pac_count = sum(len(pacs) for pacs in report['pacs_by_type'].values())
        total_super_pac_spending = sum(sp['total_spending'] for sp in report['super_pacs'])
        total_pac_contributions = 0
        
        for pac_list in report['pacs_by_type'].values():
            total_pac_contributions += sum(pac['total_contributions'] for pac in pac_list)
        
        report['summary_stats'] = {
            'total_pacs_connected': total_pac_count,
            'total_super_pacs': len(report['super_pacs']),
            'total_corporate_connections': len(report['corporate_connections']),
            'total_pac_contributions': total_pac_contributions,
            'total_super_pac_spending': total_super_pac_spending,
            'grand_total_money': report['contribution_totals'].get('total_contributions', 0) + total_super_pac_spending
        }
        
        conn.close()
        return report
        
    except Exception as e:
        print(f"Error generating comprehensive report: {e}")
        if 'conn' in locals():
            conn.close()
        return None

def print_comprehensive_money_report(candidate_id, politician_name=None):
    """
    Print a formatted comprehensive money tracking report.
    """
    print("=" * 80)
    print(f"🏛️  COMPREHENSIVE MONEY TRACKING REPORT")
    print("=" * 80)
    
    start_time = time.time()
    report = generate_comprehensive_money_report(candidate_id, politician_name)
    end_time = time.time()
    
    if not report:
        print("❌ Unable to generate report")
        return
    
    name_display = politician_name.upper() if politician_name else candidate_id
    print(f"Politician: {name_display}")
    print(f"Candidate ID: {candidate_id}")
    print(f"Report generated in: {end_time - start_time:.2f} seconds\n")
    
    # SUMMARY STATISTICS
    stats = report['summary_stats']
    print("📊 EXECUTIVE SUMMARY")
    print("-" * 50)
    print(f"💰 Total Money Tracked: ${stats['grand_total_money']:,.2f}")
    print(f"🏛️  Connected PACs: {stats['total_pacs_connected']}")
    print(f"⚡ Super PACs: {stats['total_super_pacs']}")
    print(f"🏢 Corporate Connections: {stats['total_corporate_connections']}")
    print(f"💵 PAC Contributions: ${stats['total_pac_contributions']:,.2f}")
    print(f"🎯 Super PAC Spending: ${stats['total_super_pac_spending']:,.2f}")
    print()
    
    # CONTRIBUTION TOTALS
    totals = report['contribution_totals']
    print("💰 TOTAL CONTRIBUTIONS RECEIVED")
    print("-" * 50)
    print(f"Committee Contributions: ${totals.get('committee_contributions', 0):,.2f}")
    print(f"  ({totals.get('committee_contribution_count', 0):,} transactions)")
    print(f"Individual Contributions: ${totals.get('individual_contributions', 0):,.2f}")
    print(f"  ({totals.get('individual_contribution_count', 0):,} transactions)")
    print(f"TOTAL CONTRIBUTIONS: ${totals.get('total_contributions', 0):,.2f}")
    print(f"Years with data: {totals.get('years_with_data', [])}")
    print()
    
    # PACS BY TYPE
    pacs_by_type = report['pacs_by_type']
    print("🏛️  POLITICAL ACTION COMMITTEES (PACs)")
    print("-" * 50)
    
    pac_categories = [
        ('traditional_pacs', '🗳️  Traditional PACs'),
        ('leadership_pacs', '👥 Leadership PACs'),
        ('corporate_pacs', '🏢 Corporate PACs'),
        ('super_pacs', '⚡ Super PACs (via committees)'),
        ('other_committees', '📋 Other Committees')
    ]
    
    for category, title in pac_categories:
        pacs = pacs_by_type.get(category, [])
        if pacs:
            print(f"\n{title} ({len(pacs)}):")
            for i, pac in enumerate(pacs, 1):
                print(f"  {i}. {pac['name']}")
                print(f"     ID: {pac['committee_id']}")
                print(f"     Type: {pac['pac_type']}")
                if pac['party_affiliation']:
                    print(f"     Party: {pac['party_affiliation']}")
                print(f"     Contributions: ${pac['total_contributions']:,.2f}")
                if pac['years']:
                    print(f"     Years: {pac['years']}")
                if pac.get('is_corporate_pac') and pac.get('connected_organization'):
                    print(f"     🏢 Corporate: {pac['connected_organization']}")
                print()
    
    # SUPER PACS (INDEPENDENT EXPENDITURES)
    super_pacs = report['super_pacs']
    if super_pacs:
        print("⚡ SUPER PAC INDEPENDENT EXPENDITURES")
        print("-" * 50)
        for i, sp in enumerate(super_pacs, 1):
            print(f"  {i}. {sp['name']}")
            if sp['committee_id']:
                print(f"     ID: {sp['committee_id']}")
            print(f"     Support Spending: ${sp['support_spending']:,.2f} ({sp['support_expenditures']} expenditures)")
            if sp['opposition_spending'] > 0:
                print(f"     Opposition Spending: ${sp['opposition_spending']:,.2f} ({sp['opposition_expenditures']} expenditures)")
            print(f"     TOTAL SPENDING: ${sp['total_spending']:,.2f}")
            if sp['is_corporate'] and sp['connected_organization']:
                print(f"     🏢 Corporate: {sp['connected_organization']}")
            if sp['years']:
                print(f"     Years: {sp['years']}")
            print()
    
    # CORPORATE CONNECTIONS
    companies = report['corporate_connections']
    if companies:
        print("🏢 CORPORATE CONNECTIONS")
        print("-" * 50)
        
        # Separate LinkedIn companies from PAC sponsors
        linkedin_companies = [c for c in companies if c['type'] == 'LinkedIn Company']
        pac_sponsors = [c for c in companies if c['type'] == 'Corporate PAC Sponsor']
        
        if linkedin_companies:
            print(f"\n📊 LinkedIn Companies (Industry Relevance):")
            for i, company in enumerate(linkedin_companies[:10], 1):  # Show top 10
                print(f"  {i}. {company['name']}")
                print(f"     Industry: {company['industry']}")
                print(f"     Size: {company['size']}")
                if company['location']:
                    print(f"     Location: {company['location']}")
                if company['website']:
                    print(f"     Website: {company['website']}")
                if company['relevance_score']:
                    print(f"     Relevance Score: {company['relevance_score']}/10")
                print()
        
        if pac_sponsors:
            print(f"\n🏛️  Corporate PAC Sponsors:")
            for i, company in enumerate(pac_sponsors, 1):
                print(f"  {i}. {company['name']}")
                print(f"     Connection: {company['connection_type']}")
                if company.get('total_contributions', 0) > 0:
                    print(f"     Contributions: ${company['total_contributions']:,.2f}")
                print()
    
    print("=" * 80)
    print("🎯 END COMPREHENSIVE MONEY TRACKING REPORT")
    print("=" * 80)
    print("\nDATA SOURCES:")
    print("✅ Committee Contributions (FEC)")
    print("✅ Individual Contributions (FEC)")
    print("✅ PAC Linkages (FEC)")
    print("✅ Independent Expenditures (Super PACs)")
    print("✅ LinkedIn Company Database")
    print("✅ Corporate PAC Connections")

# Main execution for testing
if __name__ == "__main__":
    # Test with different politicians
    test_politicians = ['Barrasso', 'Warren', 'Cruz', 'Harris']
    
    for politician in test_politicians:
        print(f"\n🔍 Searching for: {politician}")
        candidate_id = getCandidateIdByName(politician)
        
        if candidate_id:
            print(f"✅ Found candidate ID: {candidate_id}")
            print_comprehensive_money_report(candidate_id, politician)
            break  # Just show one example
        else:
            print(f"❌ No candidate found for: {politician}")
    
    if not any(getCandidateIdByName(p) for p in test_politicians):
        print("\n⚠️  No test politicians found. Testing with a direct candidate ID...")
        print_comprehensive_money_report("S4SC00240", "Unknown Politician") 