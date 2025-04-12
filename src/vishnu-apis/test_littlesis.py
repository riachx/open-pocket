import littlesis
from littlesis import littlesis as ls
import json
from pprint import pprint
import time

def test_politician_data(name: str):
    print(f"\n=== Testing LittleSis API for: {name} ===\n")

    def api_call_with_retry(func, *args, max_retries=3, delay=0.5):
        """Helper function to handle API calls with retry logic"""
        for attempt in range(max_retries):
            try:
                time.sleep(delay)  # Wait before making the API call
                return func(*args)
            except Exception as e:
                if attempt == max_retries - 1:  # Last attempt
                    raise e
                print(f"Attempt {attempt + 1} failed, retrying after {delay} seconds...")
                time.sleep(delay * 2)  # Exponential backoff
                delay *= 2
    
    try:
        print("1. Getting ID...")
        id = api_call_with_retry(ls.name_to_id, name)
        print(f"ID: {id}\n")

        print("2. Getting basic entity info...")
        entity_info = api_call_with_retry(ls.entity, name)
        print("Basic Info:")
        pprint(entity_info)
        print()

        print("3. Getting biography...")
        bio = api_call_with_retry(ls.bio, name)
        print(f"Biography: {bio}\n")

        print("4. Getting lists with descriptions...")
        lists = api_call_with_retry(ls.lists_w_descriptions, name)
        print("Lists:")
        pprint(lists)
        print()

        print("5. Getting relationship blurbs with amounts...")
        try:
            rel_blurbs = api_call_with_retry(ls.relationship_blurbs_w_amounts, name)
            
            if rel_blurbs is None:
                print("No relationship blurbs found")
                return
                
            # Filter for only organizational contributions
            org_contributions = [
                blurb for blurb in rel_blurbs 
                if isinstance(blurb, str) and  # Make sure blurb is a string
                "gave money to" in blurb and 
                not any(title in blurb.split("  gave money to  ")[0] for title in ["Mr.", "Mrs.", "Ms.", "Dr."]) and
                len(blurb.split("  gave money to  ")[0].split()) > 1  # Simple heuristic for organizations (more than one word)
            ]
            
            if not org_contributions:
                print("No organizational contributions found")
            else:
                print("Organizational Contributions:")
                pprint(org_contributions)
            print()
            
        except Exception as e:
            print(f"Error in getting relationship blurbs: {str(e)}")
            print("Raw blurbs received:", rel_blurbs)  # Debug print
        print()

    except Exception as e:
        print(f"Error occurred: {str(e)}")

# Test with a politician
test_politician_data("Tim Kaine")
