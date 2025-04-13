from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
import json
from datetime import datetime
import google.generativeai as genai
import os
from dotenv import load_dotenv
import sqlite3
import httpx

load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

@dataclass
class SystemContext:
    """System-level context that defines the agent's capabilities and constraints"""
    role: str = "financial_integrity_analyst"
    capabilities: List[str] = field(default_factory=lambda: [
        "search_politicians",
        "analyze_contributions",
        "assess_integrity",
        "provide_summaries"
    ])
    constraints: List[str] = field(default_factory=lambda: [
        "only_analyze_available_data",
        "no_speculation_about_motives",
        "focus_on_factual_patterns"
    ])

@dataclass
class FinancialContext:
    """Financial data context for a specific politician"""
    candidate_id: str
    name: str
    contributions: Dict[str, Any]
    years_analyzed: List[int]
    last_updated: str

@dataclass
class ConversationContext:
    """Maintains the conversation state and history"""
    messages: List[Dict[str, str]] = field(default_factory=list)
    current_politician: Optional[str] = None
    analysis_depth: str = "standard"

class MCPProtocol:
    """Model Context Protocol implementation for political finance analysis"""
    
    def __init__(self):
        self.system_context = SystemContext()
        self.financial_context = None
        self.conversation_context = ConversationContext()
        try:
            # List available models first
            models = genai.list_models()
            print("Available models:", [model.name for model in models])
            self.model = genai.GenerativeModel('models/gemini-1.5-pro-latest')
        except Exception as e:
            print(f"Error initializing Gemini model: {e}")
            self.model = None

    def get_system_prompt(self) -> str:
        """Generate the system prompt that defines the agent's role and capabilities"""
        return f"""You are a Political Finance Analysis Agent with the following role and capabilities:
Role: {self.system_context.role}
Capabilities: {', '.join(self.system_context.capabilities)}
Constraints: {', '.join(self.system_context.constraints)}

You analyze campaign finance data to assess political funding patterns and integrity.
All responses should be based on actual data from the FEC database."""

    def build_context_window(self, query: str) -> Dict[str, Any]:
        """Build the context window for the current query"""
        return {
            "system": self.get_system_prompt(),
            "conversation_history": self.conversation_context.messages[-5:],  # Last 5 messages
            "current_analysis": self._get_current_analysis_context(),
            "query": query,
            "available_tools": {
                "search_candidate": "Find a politician by name",
                "get_contributions": "Get contribution data for a candidate",
                "analyze_integrity": "Perform integrity analysis on contribution patterns"
            }
        }

    def _get_current_analysis_context(self) -> Dict[str, Any]:
        """Get the current analysis context if available"""
        if not self.financial_context:
            return {}
        return {
            "politician": self.financial_context.name,
            "data_timeframe": f"{min(self.financial_context.years_analyzed)}-{max(self.financial_context.years_analyzed)}",
            "analysis_depth": self.conversation_context.analysis_depth
        }

    async def process_query(self, query: str) -> Dict[str, Any]:
        """Process a query using the MCP pattern"""
        # Build context window
        context_window = self.build_context_window(query)
        
        # Update conversation context
        self.conversation_context.messages.append({
            "role": "user",
            "content": query
        })

        # Determine required tools based on query
        tools_needed = self._determine_required_tools(query)
        
        # Execute tools and gather data
        response_data = await self._execute_tools(tools_needed, query)
        
        # Generate LLM response using Gemini
        if "candidate_found" in response_data:
            if self.model:
                prompt = self._build_gemini_prompt(context_window, response_data)
                try:
                    response = self.model.generate_content(prompt)
                    response_data["agent_message"] = response.text
                except Exception as e:
                    response_data["agent_message"] = self._format_fallback_analysis(response_data)
            else:
                response_data["agent_message"] = self._format_fallback_analysis(response_data)
        else:
            response_data["agent_message"] = "I couldn't find that politician in the database. Please try another name."

        return {
            "context_window": context_window,
            "response": response_data,
            "suggested_followups": self._generate_followup_suggestions(response_data)
        }

    def _build_gemini_prompt(self, context_window: Dict[str, Any], data: Dict[str, Any]) -> str:
        """Build a prompt for Gemini based on the context and data"""
        if "financial_data" not in data:
            return "Please analyze this politician but note that financial data is unavailable."
            
        total = data["financial_data"].get("total_amount", 0)
        contributions = data["financial_data"].get("contributions", {})
        
        # Sort contributors by amount
        sorted_contributors = sorted(
            contributions.items(),
            key=lambda x: x[1]["amount"],
            reverse=True
        )[:10]  # Get top 10 contributors
        
        prompt = f"""As a Political Finance Analysis Agent, analyze the following campaign finance data:

Total Contributions: ${total:,.2f}

Top 10 Contributors:
"""
        
        for contributor, info in sorted_contributors:
            prompt += f"- {contributor}: ${info['amount']:,.2f} ({info['industry']})\n"
        
        if "integrity_analysis" in data:
            prompt += "\nIndustry Breakdown:\n"
            for industry, amount in data["integrity_analysis"].items():
                prompt += f"- {industry}: ${amount:,.2f}\n"
        
        prompt += """
Please provide:
1. A summary of the contribution patterns, including major industries and types of contributors
2. Notable concentrations of funding by industry or contributor type
3. Potential areas of concern based on the contribution patterns
4. Overall assessment of financial transparency

Keep the tone professional and factual, focusing only on verifiable data."""

        return prompt

    async def _execute_tools(self, tools_needed: List[str], query: str) -> Dict[str, Any]:
        """Execute the necessary tools based on the query"""
        from candidate_functions import search_candidate
        from contribute import get_contributions_by_candidate, query_contributors_by_industry
        import sqlite3
        import os

        # Get the absolute path to the database
        current_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(current_dir, 'politicaldata.db')
        print(f"\nDebug: Looking for database at: {db_path}")
        print(f"Debug: Database exists: {os.path.exists(db_path)}")
        print(f"Debug: Tools needed: {tools_needed}")

        results = {
            "analysis_performed": True,
            "timestamp": datetime.now().isoformat(),
            "query_analyzed": query
        }
        
        try:
            if "search_candidate" in tools_needed:
                name = query.replace("Analyze the campaign contributions for ", "")
                print(f"Debug: Searching for candidate: {name}")
                candidate_id = search_candidate(name, auto_select_first=True)
                print(f"Debug: Auto-selected candidate ID: {candidate_id}")
                
                if candidate_id:
                    results["candidate_id"] = candidate_id
                    results["candidate_found"] = True
                    
                    try:
                        # Use the correct database path
                        conn = sqlite3.connect(db_path)
                        cursor = conn.cursor()
                        
                        # Debug: Check if table exists and has data
                        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='contributorsFromCommittees'")
                        table_exists = cursor.fetchone()
                        print(f"Debug: Table exists: {bool(table_exists)}")
                        
                        if table_exists:
                            cursor.execute("SELECT COUNT(*) FROM contributorsFromCommittees")
                            row_count = cursor.fetchone()[0]
                            print(f"Debug: Number of rows in table: {row_count}")
                        
                        if "get_contributions" in tools_needed:
                            print(f"Debug: Getting contributions for candidate: {candidate_id}")
                            contributions = get_contributions_by_candidate(candidate_id)
                            print(f"Debug: Got contributions: {bool(contributions)}")
                            
                            if contributions:
                                results["financial_data"] = {
                                    "contributions": contributions,
                                    "total_amount": sum(info['amount'] for info in contributions.values())
                                }
                                print(f"Debug: Total amount: ${results['financial_data']['total_amount']:,.2f}")
                            
                            if "analyze_integrity" in tools_needed:
                                industry_analysis = query_contributors_by_industry(candidate_id)
                                if industry_analysis:
                                    results["integrity_analysis"] = industry_analysis
                        
                        conn.close()
                    except sqlite3.Error as e:
                        error_msg = f"Database error: {str(e)}"
                        results["error"] = error_msg
                        print(f"Debug: {error_msg}")
        except Exception as e:
            error_msg = f"Error in _execute_tools: {str(e)}"
            results["error"] = error_msg
            print(f"Debug: {error_msg}")
        
        print(f"Debug: Final results: {json.dumps(results, indent=2)}")
        return results

    def _determine_required_tools(self, query: str) -> List[str]:
        """Determine which tools are needed based on the query"""
        tools = []
        query_lower = query.lower()
        
        # If analyzing contributions, we always need to search first
        if "analyze" in query_lower and "contributions" in query_lower:
            tools.append("search_candidate")
            tools.append("get_contributions")
            tools.append("analyze_integrity")
        elif any(word in query_lower for word in ["who", "find", "search"]):
            tools.append("search_candidate")
            
        print(f"Debug: Determined tools needed: {tools}")  # Debug print
        return tools

    def _generate_followup_suggestions(self, response_data: Dict[str, Any]) -> List[str]:
        """Generate relevant follow-up questions based on the response"""
        suggestions = []
        
        if "financial_data" in response_data:
            suggestions.extend([
                "Would you like to see the top contributors?",
                "Should I analyze the industry concentration?",
                "Would you like to compare this with similar politicians?"
            ])
            
        return suggestions

    def _update_financial_context(self, financial_data: Dict[str, Any]) -> None:
        """Update the financial context with new data"""
        from datetime import datetime
        
        if not self.financial_context:
            self.financial_context = FinancialContext(
                candidate_id=financial_data["candidate_id"],
                name=financial_data["name"],
                contributions=financial_data["contributions"],
                years_analyzed=financial_data["years"],
                last_updated=datetime.now().isoformat()
            )

    def _format_fallback_analysis(self, data: Dict[str, Any]) -> str:
        """Format a basic analysis when LLM is unavailable"""
        if "financial_data" not in data:
            return "No financial data available for analysis."
        
        total = data["financial_data"]["total_amount"]
        
        # Get top 5 contributors
        sorted_contributors = sorted(
            data["financial_data"]["contributions"].items(),
            key=lambda x: x[1]["amount"],
            reverse=True
        )[:5]
        
        analysis = [
            f"Analysis of campaign contributions:",
            f"\nTotal contributions: ${total:,.2f}",
            "\nTop 5 contributors:",
        ]
        
        for contributor, info in sorted_contributors:
            analysis.append(f"- {contributor}: ${info['amount']:,.2f} ({info['industry']})")
        
        if "integrity_analysis" in data:
            analysis.append("\nIndustry breakdown:")
            for industry, amount in data["integrity_analysis"].items():
                analysis.append(f"- {industry}: ${amount:,.2f}")
        
        return "\n".join(analysis)

# Example usage
async def main():
    protocol = MCPProtocol()
    response = await protocol.process_query("Analyze the campaign contributions for Tom Cotton")
    print(json.dumps(response, indent=2))

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())