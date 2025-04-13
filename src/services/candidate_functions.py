import os
from dotenv import load_dotenv
import httpx

load_dotenv()

API_KEY = os.getenv("OPENFEC_API_KEY")
BASE_URL = "https://api.open.fec.gov/v1"

if not API_KEY:
    raise ValueError("OPENFEC_API_KEY is not set. Make sure it's in your .env file.")


def search_candidate(name, auto_select_first=False):
    """
    Search for a candidate with a specific name
    
    Args:
        name: Name to search for
        auto_select_first: If True, automatically select the first match
    
    Returns:
        str: The candidate ID if found, None if not found.
    """
    url = f"{BASE_URL}/candidates/search/"
    params = {
        "api_key": API_KEY,
        "q": name,
        "page": 1,
        "per_page": 5,
        "sort": "-election_years"  # Sort by most recent election year
    }
    try:
        response = httpx.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        if not data["results"]:
            print(f"No candidates found matching '{name}'")
            return None
            
        # If auto_select_first is True, select the most recent active candidate
        if auto_select_first and data["results"]:
            # Sort by most recent election year and prefer Senate/House over Presidential
            candidates = sorted(
                data["results"],
                key=lambda x: (
                    max(x.get('election_years', [0])),  # Most recent year first
                    x['office_full'] != 'President'  # Prefer Senate/House over President
                ),
                reverse=True
            )
            return candidates[0]["candidate_id"]
            
        # Print all matches
        print(f"\nFound {len(data['results'])} matching candidates:")
        for i, result in enumerate(data["results"], 1):
            print(f"\n{i}. {result['name']}")
            print(f"   Office: {result['office_full']}")
            print(f"   Party: {result.get('party_full', 'N/A')}")
            print(f"   Election Years: {result.get('election_years', ['N/A'])}")
            print(f"   Candidate ID: {result['candidate_id']}")
            print("-" * 40)
        
        if len(data["results"]) == 1:
            return data["results"][0]["candidate_id"]
            
        # Let user choose if multiple matches
        while True:
            choice = input("\nEnter the number of the candidate you want (or 'q' to quit): ")
            if choice.lower() == 'q':
                return None
            try:
                index = int(choice) - 1
                if 0 <= index < len(data["results"]):
                    return data["results"][index]["candidate_id"]
                print("Invalid number. Please try again.")
            except ValueError:
                print("Please enter a valid number or 'q' to quit.")
                
    except httpx.HTTPError as e:
        print(f"Error accessing FEC API: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None

def candidate_info(candidate_id):
    """
    Get detailed information about a candidate given their FEC candidate ID.

    Args:
        candidate_id (str): The FEC ID of the candidate.

    Returns:
        dict: A dictionary of candidate details.
    """
    url = f"{BASE_URL}/candidate/{candidate_id}/"

    params = {
        "api_key": API_KEY
    }

    response = httpx.get(url, params=params)
    if response.status_code != 200:
        raise ValueError(f"Failed to fetch candidate info: {response.text}")

    data = response.json()

    if not data["results"]:
        return None

    result = data["results"][0]
    return {
        "name": result.get("name"),
        "party": result.get("party_full", "N/A"),
        "office": result.get("office_full", "N/A"),
        "state": result.get("state", "N/A"),
        "status": result.get("candidate_status", "N/A"),
        "first_election_year": result.get("first_election_year", "N/A"),
        "last_election_year": result.get("election_years", [])[-1] if result.get("election_years") else "N/A",
    }

