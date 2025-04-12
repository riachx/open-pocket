import requests

API_KEY = 'tq7etbEZurHC2Ox3gnsql18bdI94eLMy3GMg6Qzh'
BASE_URL = 'https://api.open.fec.gov/v1'

def get_candidate_committees(candidate_id, api_key):
    """Get the authorized committees for a candidate"""
    params = {
        'api_key': api_key,
        'candidate_id': candidate_id,
        'designation': ['P', 'A']  # Principal campaign committee and Authorized committees
    }
    
    response = requests.get(f'{BASE_URL}/candidate/{candidate_id}/committees', params=params)
    if response.status_code != 200:
        print(f"Error getting committees: {response.json()}")
        return []
        
    data = response.json()
    return [committee['committee_id'] for committee in data.get('results', [])]

def get_pac_funding(candidate_id, api_key, start_date=None):
    """Get PAC contributions for a candidate within specified timeframe"""
    from datetime import datetime, timedelta
    
    # If no start date provided, default to 2 years ago
    if not start_date:
        start_date = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d')

    # Get current date for max_date
    current_date = datetime.now().strftime('%Y-%m-%d')

    # Get the candidate's committee IDs
    committee_ids = get_candidate_committees(candidate_id, api_key)
    if not committee_ids:
        print(f"No committees found for candidate {candidate_id}")
        return []
        
    print(f"Found committees for candidate: {committee_ids}")

    all_results = []
    
    # Get contributions for each committee
    for committee_id in committee_ids:
        page = 1
        while True:
            params = {
                'api_key': api_key,
                'committee_id': committee_id,  # Get contributions TO this committee
                'min_date': start_date,
                'max_date': current_date,
                'contributor_type': 'committee',
                'min_amount': 1000,
                'per_page': 100,
                'page': page,
                'sort': '-contribution_receipt_date'
            }

            print(f"Querying contributions for committee {committee_id} (page {page})")
            
            response = requests.get(f'{BASE_URL}/schedules/schedule_a/', params=params)
            
            if response.status_code != 200:
                print(f"Error: {response.json()}")
                break

            data = response.json()
            results = data.get('results', [])
            pagination = data.get('pagination', {})
            
            if results:
                all_results.extend(results)
                print(f"Retrieved {len(results)} contributions")
                print(f"Date range: {results[-1]['contribution_receipt_date'][:10]} to {results[0]['contribution_receipt_date'][:10]}")
            
            if not results or page >= pagination.get('last_page', 1):
                break
                
            page += 1

    return all_results

def get_candidate_info(candidate_name):
    """Get candidate information and PAC funding"""
    params = {
        'api_key': API_KEY,
        'q': candidate_name,
        'sort': 'name',     
        'sort_hide_null': False,    
        'per_page': 20,             
        'candidate_status': 'C'      
    }
    
    response = requests.get(f'{BASE_URL}/candidates/search', params=params)
    if response.status_code != 200:
        print(f"Error: API request failed with status code {response.status_code}")
        print(f"Response: {response.text}")  
        return None
    
    data = response.json()
    if 'results' not in data:
        print("Error: Unexpected API response format")
        print("Response:", data)
        return None
    
    # Get candidate ID from search results
    candidates = data['results']
    if not candidates:
        print(f"No candidates found matching '{candidate_name}'")
        return

    candidate = candidates[0]
    candidate_id = candidate['candidate_id']
    
    # Debug information
    print(f"\nCandidate found: {candidate['name']}")
    print(f"Candidate ID: {candidate_id}")
    print(f"Office: {candidate.get('office_full', 'Unknown')}")
    print(f"State: {candidate.get('state', 'Unknown')}")
    print("Fetching PAC contributions...\n")
    
    # Get PAC contributions
    pac_contributions = get_pac_funding(candidate_id, API_KEY)
    
    # Calculate total contributions
    total_contributions = sum(contrib['contribution_receipt_amount'] for contrib in pac_contributions)
    
    # Print results
    print(f"\nFinancial data for {candidate_name}:")
    if pac_contributions:
        print("\nRecent PAC/Organization Contributions:")
        for contrib in pac_contributions:
            print(f"{contrib['contributor_name']}: ${contrib['contribution_receipt_amount']:.2f} "
                  f"on {contrib['contribution_receipt_date'][:10]}")
        print(f"\nTotal PAC Contributions: ${total_contributions:,.2f}")
    else:
        print("No PAC contributions found in the specified timeframe")
    
    return data

def get_candidate_financials(candidate_id):
    params = {
        'api_key': API_KEY,
        'sort': '-cycle'  # Get most recent election cycle first
    }
    
    response = requests.get(f'{BASE_URL}/candidate/{candidate_id}/totals', params=params)
    return response.json()

# candidate_name = "Sanders"
get_candidate_info("Warren, Elizabeth")
get_candidate_info("John")

# if results and results['results']:
#     candidate = results['results'][0]
#     candidate_id = candidate['candidate_id']
#     financials = get_candidate_financials(candidate_id)
#     print(f"Financial data for {candidate['name']}:")
#     print(financials)
# else:
#     print("No results found or error occurred")
