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