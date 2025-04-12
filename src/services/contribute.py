import csv
from collections import defaultdict
from candidate_functions import search_candidate

# Step 1: Load header from CSV
def load_headers(header_csv_path):
    with open(header_csv_path, newline='') as csvfile:
        reader = csv.reader(csvfile)
        headers = next(reader)
    return headers

# Step 2: Parse contributions and index by candidate ID
def parse_contributions(data_path, headers):
    candidate_contributions = defaultdict(lambda: defaultdict(lambda: {'amount': 0.0, 'entity_tp': None}))
    
    with open(data_path, 'r', encoding='utf-8') as file:
        for line in file:
            parts = line.strip().split('|')
            if len(parts) != len(headers):
                continue  # skip malformed lines
            data = dict(zip(headers, parts))
            candidate_id = data['CAND_ID']  # candidate
            contributor_id = data['NAME']   # committee name as contributor
            entity_type = data['ENTITY_TP']
            amount = float(data['TRANSACTION_AMT'])
            
            # Store both amount and entity type
            candidate_contributions[candidate_id][contributor_id]['amount'] += amount
            candidate_contributions[candidate_id][contributor_id]['entity_tp'] = entity_type

    return candidate_contributions

# Step 3: Query function
def query_contributors(candidate_id, contributions_dict):
    if candidate_id not in contributions_dict:
        print(f"No contributions found for candidate ID {candidate_id}")
        return
    
    print(f"Contributions to Candidate ID {candidate_id}:\n")
    for contributor, info in contributions_dict[candidate_id].items():
        # Skip individual contributors
        if info['entity_tp'] == 'IND':
            continue
        print(f"{contributor}: ${info['amount']:,.2f}")

# --- Run the script ---
headers = load_headers('/Users/riachockalingam/Documents/cruzhacks/politicians/data/pas2_header_file.csv')
contributions = parse_contributions('/Users/riachockalingam/Documents/cruzhacks/politicians/data/itpas2.txt', headers)

# Example usage
candidate_id = search_candidate('Donald Trump')

#candidate_id = 'S8GA00180'
print("Candidate {candidate_id} received:")
query_contributors(candidate_id, contributions)
