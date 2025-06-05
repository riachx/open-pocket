import sqlite3
import time
from candidate_functions import getCandidateIdByName

def get_db_connection():
    """Get a connection to the SQLite database with proper error handling"""
    try:
        db_path = 'src/services/politicaldata.db'
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

def get_politician_full_name(candidate_id, conn=None):
    """
    Get the full name of a politician from the database.
    
    Args:
        candidate_id (str): The candidate ID to look up
        conn: Optional database connection to reuse
        
    Returns:
        str: Full politician name if found, otherwise the candidate ID
    """
    try:
        should_close = conn is None
        if conn is None:
            conn = get_db_connection()
        cursor = conn.cursor()
        
        # Try to get name from candidates_master table first (most reliable)
        cursor.execute('''
            SELECT CAND_NAME FROM candidates_master WHERE CAND_ID = ?
            LIMIT 1
        ''', (candidate_id,))
        result = cursor.fetchone()
        
        if result and result[0]:
            if should_close:
                conn.close()
            return result[0]
        
        # Try to get name from candidates table
        cursor.execute('''
            SELECT CAND_NAME FROM candidates WHERE CAND_ID = ?
            LIMIT 1
        ''', (candidate_id,))
        result = cursor.fetchone()
        
        if result and result[0]:
            if should_close:
                conn.close()
            return result[0]
        
        # If no name found in candidate tables, try senators table
        # (This would need more sophisticated matching logic in practice)
        cursor.execute('''
            SELECT name FROM senators WHERE name IS NOT NULL AND name != ''
            ORDER BY name
            LIMIT 1
        ''')
        result = cursor.fetchone()
        
        if should_close:
            conn.close()
        
        if result and result[0]:
            return result[0]
        else:
            return candidate_id  # Return candidate ID if no name found
        
    except Exception as e:
        print(f"Error getting politician name: {e}")
        if should_close and conn:
            conn.close()
        return candidate_id

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

def get_industry_for_company(company_name, cursor):
    """
    Determine the industry for a company based on its name and available data.
    """
    print(f"\nDetermining industry for: {company_name}")
    
    # Common industry mappings for political companies
    industry_keywords = {
        'DATA': 'Data & Analytics',
        'SERVICES': 'Professional Services',
        'CONSULTING': 'Professional Services',
        'CONSULTANTS': 'Professional Services',
        'MARKETING': 'Marketing & Advertising',
        'CREATIVE': 'Marketing & Advertising',
        'PRINTING': 'Printing & Publishing',
        'MAIL': 'Printing & Publishing',
        'FUND': 'Political Organization',
        'ACTION': 'Political Organization',
        'POLITICAL': 'Political Organization',
        'STRATEGIES': 'Political Consulting',
        'OUTREACH': 'Political Consulting',
        'MESSAGE': 'Political Consulting',
        'INNOVATIVE': 'Technology',
        'WIRED': 'Technology',
        'CLOUD': 'Technology',
        'LLC': 'Professional Services',
        'INC': 'Professional Services'
    }
    
    # First try to find in LinkedIn companies
    print("Checking LinkedIn companies...")
    cursor.execute('''
        SELECT industry 
        FROM linkedin_companies 
        WHERE LOWER(name) LIKE LOWER(?) 
        AND industry IS NOT NULL 
        LIMIT 1
    ''', (f'%{company_name}%',))
    
    linkedin_industry = cursor.fetchone()
    if linkedin_industry:
        print(f"Found LinkedIn industry: {linkedin_industry[0]}")
        return linkedin_industry[0]
    
    # If not found in LinkedIn, try to determine from company name
    print("No LinkedIn match, checking keywords...")
    company_name_upper = company_name.upper()
    for keyword, industry in industry_keywords.items():
        if keyword in company_name_upper:
            print(f"Found matching keyword '{keyword}' -> {industry}")
            return industry
    
    # Special cases
    if 'SAZERAC' in company_name_upper:
        print("Found special case: Sazerac -> Beverages & Alcohol")
        return 'Beverages & Alcohol'
    if 'SCHNEIDER' in company_name_upper:
        print("Found special case: Schneider's -> Restaurant & Hospitality")
        return 'Restaurant & Hospitality'
    
    print("No matches found, defaulting to Political Services")
    return 'Political Services'  # Default for political companies

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
        
        # First get all corporate PACs and their contributions
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
        
        corporate_pacs = cursor.fetchall()
        print(f"\nFound {len(corporate_pacs)} corporate PACs")
        
        # For each corporate PAC, try to find matching LinkedIn company
        for org_name, committee_name, committee_type, contributions in corporate_pacs:
            print(f"\nProcessing company: {org_name}")
            
            # Clean up organization name for better matching
            clean_org_name = org_name.replace(' INC', '').replace(' INC.', '').replace(' LLC', '').replace(' CORP', '').replace(' CORPORATION', '')
            first_word = clean_org_name.split()[0] if clean_org_name else ''
            
            # Try to find matching LinkedIn company
            cursor.execute('''
                SELECT lc.name, lc.industry, lc.size, lc.website, lc.city, 
                       lc.state, lc.country_code, lc.relevance_score
                FROM linkedin_companies lc
                WHERE (
                    LOWER(lc.name) LIKE LOWER(?) OR
                    LOWER(?) LIKE LOWER(lc.name) OR
                    LOWER(lc.name) LIKE LOWER(?) OR
                    LOWER(?) LIKE LOWER(lc.name)
                )
                AND lc.industry IS NOT NULL
                ORDER BY lc.relevance_score DESC NULLS LAST, lc.size_priority ASC
                LIMIT 1
            ''', (
                f'%{clean_org_name}%',
                clean_org_name,
                f'%{first_word}%',
                first_word
            ))
            
            linkedin_match = cursor.fetchone()
            
            if linkedin_match:
                print(f"Found LinkedIn match: {linkedin_match[0]} (Industry: {linkedin_match[1]})")
                name, industry, size, website, city, state, country, relevance = linkedin_match
                companies.append({
                    'name': name,
                    'type': 'Corporate PAC Sponsor',
                    'industry': industry,
                    'size': size or 'Unknown',
                    'website': website,
                    'location': f"{city}, {state}" if city and state else None,
                    'country': country or 'US',
                    'relevance_score': relevance,
                    'connection_type': f'Via {committee_name} ({committee_type})',
                    'total_contributions': contributions or 0
                })
            else:
                print(f"No LinkedIn match, determining industry from name")
                # Determine industry from company name
                industry = get_industry_for_company(org_name, cursor)
                print(f"Final determined industry: {industry}")
                
                companies.append({
                    'name': org_name,
                    'type': 'Corporate PAC Sponsor',
                    'industry': industry,
                    'size': 'Unknown',
                    'website': None,
                    'location': None,
                    'country': 'US',
                    'relevance_score': None,
                    'connection_type': f'Via {committee_name} ({committee_type})',
                    'total_contributions': contributions or 0
                })
        
        # Add additional high-relevance LinkedIn companies
        print("\nFetching additional high-relevance LinkedIn companies...")
        cursor.execute('''
            SELECT DISTINCT lc.name, lc.industry, lc.size, lc.website, lc.city, 
                   lc.state, lc.country_code, lc.relevance_score
            FROM linkedin_companies lc
            WHERE lc.industry IS NOT NULL
            AND NOT EXISTS (
                SELECT 1 FROM committees c 
                WHERE LOWER(c.connected_org_nm) LIKE LOWER(lc.name)
                OR LOWER(lc.name) LIKE LOWER(c.connected_org_nm)
            )
            ORDER BY lc.relevance_score DESC NULLS LAST, lc.size_priority ASC
            LIMIT 10
        ''')
        
        additional_companies = cursor.fetchall()
        print(f"Found {len(additional_companies)} additional high-relevance LinkedIn companies")
        
        for row in additional_companies:
            name, industry, size, website, city, state, country, relevance = row
            print(f"Adding LinkedIn company: {name} (Industry: {industry})")
            
            companies.append({
                'name': name,
                'type': 'LinkedIn Company',
                'industry': industry,
                'size': size or 'Unknown',
                'website': website,
                'location': f"{city}, {state}" if city and state else None,
                'country': country or 'US',
                'relevance_score': relevance,
                'connection_type': 'Industry Relevance'
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
        
        # Get the full politician name from database if not provided
        if not politician_name:
            politician_name = get_politician_full_name(candidate_id, conn)
        
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
    
    # Use the full name from the report (which includes database lookup)
    full_name = report['politician_name']
    name_display = full_name.upper() if full_name else candidate_id
    
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

def check_linkedin_companies_table(conn=None):
    """
    Check the LinkedIn companies table schema and content.
    """
    try:
        should_close = conn is None
        if conn is None:
            conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check table schema
        cursor.execute("PRAGMA table_info(linkedin_companies)")
        schema = cursor.fetchall()
        print("\nLinkedIn Companies Table Schema:")
        for col in schema:
            print(f"  {col[1]} ({col[2]})")
        
        # Check row count
        cursor.execute("SELECT COUNT(*) FROM linkedin_companies")
        count = cursor.fetchone()[0]
        print(f"\nTotal LinkedIn companies: {count}")
        
        # Check sample data
        cursor.execute("""
            SELECT name, industry, size, relevance_score 
            FROM linkedin_companies 
            WHERE industry IS NOT NULL 
            LIMIT 5
        """)
        sample = cursor.fetchall()
        print("\nSample LinkedIn companies with industries:")
        for row in sample:
            print(f"  {row[0]} - Industry: {row[1]}, Size: {row[2]}, Relevance: {row[3]}")
        
        if should_close:
            conn.close()
            
    except Exception as e:
        print(f"Error checking LinkedIn companies table: {e}")
        if should_close and conn:
            conn.close()

def inspect_database_structure(conn=None):
    """
    Perform a detailed inspection of the database structure and content.
    """
    try:
        should_close = conn is None
        if conn is None:
            conn = get_db_connection()
        cursor = conn.cursor()
        
        print("\n=== DATABASE STRUCTURE INSPECTION ===")
        
        # Get list of all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print("\nTables in database:")
        for table in tables:
            print(f"  - {table[0]}")
        
        # Inspect linkedin_companies table
        print("\n=== LINKEDIN_COMPANIES TABLE ===")
        cursor.execute("PRAGMA table_info(linkedin_companies)")
        schema = cursor.fetchall()
        print("\nSchema:")
        for col in schema:
            print(f"  {col[1]} ({col[2]})")
        
        # Count total companies
        cursor.execute("SELECT COUNT(*) FROM linkedin_companies")
        total = cursor.fetchone()[0]
        print(f"\nTotal companies: {total}")
        
        # Count companies with industry data
        cursor.execute("SELECT COUNT(*) FROM linkedin_companies WHERE industry IS NOT NULL")
        with_industry = cursor.fetchone()[0]
        print(f"Companies with industry data: {with_industry}")
        
        # Get sample of companies with industry data
        print("\nSample companies with industry data:")
        cursor.execute("""
            SELECT name, industry, size, relevance_score 
            FROM linkedin_companies 
            WHERE industry IS NOT NULL 
            LIMIT 5
        """)
        sample = cursor.fetchall()
        for row in sample:
            print(f"  {row[0]}")
            print(f"    Industry: {row[1]}")
            print(f"    Size: {row[2]}")
            print(f"    Relevance: {row[3]}")
        
        # Get unique industries
        print("\nUnique industries in database:")
        cursor.execute("""
            SELECT DISTINCT industry 
            FROM linkedin_companies 
            WHERE industry IS NOT NULL 
            ORDER BY industry
        """)
        industries = cursor.fetchall()
        for industry in industries:
            print(f"  - {industry[0]}")
        
        # Inspect committees table
        print("\n=== COMMITTEES TABLE ===")
        cursor.execute("PRAGMA table_info(committees)")
        schema = cursor.fetchall()
        print("\nSchema:")
        for col in schema:
            print(f"  {col[1]} ({col[2]})")
        
        # Get sample of corporate PACs
        print("\nSample corporate PACs:")
        cursor.execute("""
            SELECT cmte_nm, connected_org_nm, cmte_tp, org_tp
            FROM committees 
            WHERE connected_org_nm IS NOT NULL 
            LIMIT 5
        """)
        pacs = cursor.fetchall()
        for pac in pacs:
            print(f"  Committee: {pac[0]}")
            print(f"    Connected Org: {pac[1]}")
            print(f"    Type: {pac[2]}")
            print(f"    Org Type: {pac[3]}")
        
        if should_close:
            conn.close()
            
    except Exception as e:
        print(f"Error inspecting database: {e}")
        if should_close and conn:
            conn.close()

# Main execution for testing
if __name__ == "__main__":
    # First inspect the database structure
    print("\nInspecting database structure...")
    inspect_database_structure()
    
    # Then check LinkedIn companies specifically
    print("\nChecking LinkedIn companies table...")
    check_linkedin_companies_table()
    
    # Then run the normal test
    test_politicians = ['Barrasso']
    for politician in test_politicians:
        print(f"\n🔍 Searching for: {politician}")
        candidate_id = getCandidateIdByName(politician)
        
        if candidate_id:
            print(f"✅ Found candidate ID: {candidate_id}")
            print_comprehensive_money_report(candidate_id)
            break
        else:
            print(f"❌ No candidate found for: {politician}")
    
    if not any(getCandidateIdByName(p) for p in test_politicians):
        print("\n⚠️  No test politicians found.") 