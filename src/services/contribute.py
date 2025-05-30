import sqlite3
from collections import defaultdict
from candidate_functions import getCandidateIdByName

#VISHNU STUFF
def get_db_connection():
    """Get a connection to the SQLite database"""
    try:
        return sqlite3.connect('politicaldata.db', timeout=20)
    except sqlite3.OperationalError as e:
        print(f"Database error: {e}")
        raise

def classify_industry(contributor_name):
    """
    Classify a contributor into an industry based on their name.
    This is a simple example - you might want to use a more comprehensive mapping.
    """
    contributor_name = contributor_name.lower()
    
    industry_keywords = {
        'defense': ['defense', 'military', 'army', 'navy', 'lockheed', 'marine', 'force'],
        'tech': ['google', 'facebook', 'meta', 'digital', 'technologies', 'software'],
        'media': ['media', 'advertising', 'marketing', 'communications', 'strategies'],
        'finance': ['fund', 'financial', 'capital', 'invest', 'strat', 'market', 'busi'],
        'printing': ['print', 'imaging', 'graphics', 'press'],
        'politics': ['pac', 'congress', 'senate', 'house', 'elect', 'committee', 'campaign', 'politi', 'president', 'civi', 'friends']
    }
    
    for industry, keywords in industry_keywords.items():
        if any(keyword in contributor_name for keyword in keywords):
            return industry

    return 'other'

def get_contributions_by_candidate(candidate_id):
    """Get all contributions for a candidate from the database"""
    conn = get_db_connection()
    try:
        c = conn.cursor()
        c.execute('''
            SELECT contributor_name, entity_type, amount, year
            FROM contributorsFromCommittees
            WHERE candidate_id = ?
        ''', (candidate_id,))
        
        contributions = defaultdict(lambda: {
            'amount': 0.0,
            'entity_tp': None,
            'industry': None
        })
        
        for contributor_name, entity_type, amount, year in c.fetchall():
            contributions[contributor_name]['amount'] += amount
            contributions[contributor_name]['entity_tp'] = entity_type
            contributions[contributor_name]['industry'] = classify_industry(contributor_name)
            
        return contributions
    finally:
        conn.close()

def query_contributors(candidate_id):
    """Query and display contributors for a specific candidate"""
    if not candidate_id:
        print("No candidate ID provided")
        return
    
    contributions = get_contributions_by_candidate(candidate_id)
    if not contributions:
        print(f"No contributions found for candidate ID {candidate_id}")
        return
    
    print(f"\nContributions to Candidate ID {candidate_id}:\n")
    for contributor, info in contributions.items():
        if info['entity_tp'] == 'IND':  # Skip individual contributors
            continue
        print(f"{contributor}: ${info['amount']:,.2f}")

def query_contributors_by_industry(candidate_id):
    """Group and display contributions by industry"""
    if not candidate_id:
        print("No candidate ID provided")
        return
    
    contributions = get_contributions_by_candidate(candidate_id)
    if not contributions:
        print(f"No contributions found for candidate ID {candidate_id}")
        return
    
    industry_totals = defaultdict(float)
    for contributor, info in contributions.items():
        if info['entity_tp'] == 'IND':  # Skip individual contributors
            continue
        industry = info['industry']
        industry_totals[industry] += info['amount']
    
    print(f"\nIndustry Breakdown for Candidate ID {candidate_id}:")
    for industry, total in sorted(industry_totals.items(), key=lambda x: x[1], reverse=True):
        print(f"{industry.replace('_', ' ').title()}: ${total:,.2f}")

if __name__ == "__main__":
    # Example usage
    candidate_id = getCandidateIdByName('Barrasso')
    print(candidate_id)

    if candidate_id:
        print(f"\nDetailed contribution analysis for {candidate_id}:")
        #query_contributors_by_industry(candidate_id)
        query_contributors(candidate_id)
    

    