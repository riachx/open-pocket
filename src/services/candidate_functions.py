import os
from dotenv import load_dotenv
import httpx

load_dotenv()

API_KEY = os.getenv("OPENFEC_API_KEY")
BASE_URL = "https://api.open.fec.gov/v1"

if not API_KEY:
    raise ValueError("OPENFEC_API_KEY is not set. Make sure it's in your .env file.")


def search_candidate(name):
    """
    Search for a candidate with a specific name and let user choose if multiple matches found
    
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
        response.raise_for_status()  # Raise exception for bad status codes
        data = response.json()
        
        if not data["results"]:
            print(f"No candidates found matching '{name}'")
            return None
            
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
