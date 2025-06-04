#!/usr/bin/env python3
"""
Test script to demonstrate committee contribution functionality.

This script shows how to use the new committee contribution functions to:
1. Get major contributions made by a committee
2. Get a summary of committee contribution activity
"""

from committee_functions import (
    get_committee_contributions, 
    get_committee_contribution_summary,
    get_committee_details,
    get_committee_type_description
)

def test_committee_contributions(committee_id):
    """Test committee contribution functions with a specific committee ID"""
    
    print(f"=== Committee Contribution Analysis for {committee_id} ===\n")
    
    # Get committee details first
    details = get_committee_details(committee_id)
    if details:
        print(f"Committee Name: {details['cmte_nm']}")
        print(f"Type: {get_committee_type_description(details['cmte_tp'])}")
        print(f"State: {details['cmte_st']}")
        print(f"Is PAC: {details['is_pac']}")
        print(f"Is Corporate PAC: {details['is_corporate_pac']}")
        if details['connected_org_nm']:
            print(f"Connected Organization: {details['connected_org_nm']}")
        print()
    else:
        print(f"No details found for committee {committee_id}\n")
    
    # Get major contributions (>= $1000)
    print("=== Major Contributions ($1,000+) ===")
    contributions = get_committee_contributions(committee_id, min_amount=1000.0, limit=20)
    
    if contributions:
        print(f"Found {len(contributions)} major contributions:\n")
        
        for i, contrib in enumerate(contributions, 1):
            print(f"{i:2d}. ${contrib['amount']:>8,.2f} to {contrib['recipient_name']}")
            print(f"     Date: {contrib['transaction_date'][:8]} | Year: {contrib['year']} | Type: {contrib['transaction_type']}")
            if contrib['recipient_id']:
                print(f"     Recipient ID: {contrib['recipient_id']}")
            if contrib['city'] and contrib['state']:
                print(f"     Location: {contrib['city']}, {contrib['state']}")
            print()
    else:
        print("No major contributions found.\n")
    
    # Get contribution summary
    print("=== Contribution Summary ===")
    summary = get_committee_contribution_summary(committee_id)
    
    if summary:
        print(f"Total Contributions: {summary['total_contributions']:,}")
        print(f"Total Amount: ${summary['total_amount']:,.2f}")
        print(f"Average Amount: ${summary['average_amount']:,.2f}")
        print(f"Years Active: {summary['years_active']}")
        print()
        
        if summary['top_recipients']:
            print("Top Recipients:")
            for i, recipient in enumerate(summary['top_recipients'][:5], 1):
                print(f"  {i}. {recipient['name']}")
                print(f"     Total: ${recipient['total_amount']:,.2f} ({recipient['contribution_count']} contributions)")
            print()
        
        if summary['contribution_by_year']:
            print("Contributions by Year:")
            for year, data in summary['contribution_by_year'].items():
                print(f"  {year}: ${data['total_amount']:>10,.2f} ({data['count']:>3} contributions)")
            print()
        
        if summary['contribution_by_state']:
            print("Top States by Contribution Amount:")
            for i, (state, data) in enumerate(list(summary['contribution_by_state'].items())[:5], 1):
                print(f"  {i}. {state}: ${data['total_amount']:,.2f} ({data['count']} contributions)")
    else:
        print("No contribution summary available.")

if __name__ == "__main__":
    # Test with known active committees
    test_committees = [
        'C00000059',  # Hallmark Cards PAC
        'C00213512',  # Nancy Pelosi for Congress
        'C00492421',  # Nancy Pelosi Victory Fund
    ]
    
    for committee_id in test_committees:
        test_committee_contributions(committee_id)
        print("\n" + "="*80 + "\n")
    
    # Interactive mode
    print("Enter a committee ID to analyze (or 'quit' to exit):")
    while True:
        user_input = input("Committee ID: ").strip()
        if user_input.lower() in ['quit', 'exit', 'q']:
            break
        if user_input:
            print()
            test_committee_contributions(user_input)
            print("\n" + "="*80 + "\n") 