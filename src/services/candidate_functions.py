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
    Search for a candidate with a specific name

    Returns:
        str: The candidate ID if found, None if not found.
    """
    url = f"{BASE_URL}/candidates/search/"
    params = {
        "api_key": API_KEY,
        "q": name,
        "page": 1,
        "per_page": 5
    }
    response = httpx.get(url, params=params)
    data = response.json()

    for result in data["results"]:
        print(f"Name: {result['name']}")
        print(f"Office: {result['office_full']}")
        print(f"Party: {result.get('party_full', 'N/A')}")
        print(f"Candidate ID: {result['candidate_id']}")
        print(f"Year: {result.get('election_year', 'N/A')}") # get doesn't error if the value doesn't exist
        print("-" * 40)
        return result['candidate_id']  # Return the first matching candidate's ID
    
    return None  # Return None if no candidates found

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


