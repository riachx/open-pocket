import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Image,
  VStack,
  Heading,
  Text,
  Spinner,
  Center,
  Grid,
  Button,
  Flex,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Input,
  IconButton,
  Avatar,
  Divider,
  Tooltip,
  Link,
  HStack,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react';
import { ArrowBackIcon, ArrowForwardIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import ChatBot from '../components/ChatBot';
import RecentVoteInfo from '../components/RecentVoteInfo';
import CongressmanBanner from '../components/CongressmanBanner';
import CommitteesSection from '../components/CommitteesSection';

interface Congressman {
  id: number;
  name: string;
  state: string;
  party: string;
  chamber: string;
  image: string;
  congress: number;
  bioguide_id: string;
}


interface Message {
  role: 'user' | 'assistant';
  content: string;
}


interface VoteInfo {
  votes: Array<{
    congress: number;
    session: number;
    voteNumber: number;
    legislation: string;
    result: string;
    date: string;
    question: string;
    voteCast?: string;
    billInfo?: {
      title?: string;
      shortTitle?: string;
      latestAction?: string;
      policyArea?: string;
      legislativeSubjects?: string[];
    };
  }>;
}

// Updated interfaces for money tracking data
interface Committee {
  committee_id: string;
  name: string;
  pac_type: string;
  designation: string;
  party_affiliation: string;
  is_corporate_pac: boolean;
  connected_organization?: string;
  total_contributions: number;
  years: number[];
  pac_category: string;
}

interface CommitteeData {
  totalContributions: number;
  totalCommittees: number;
  committees: Committee[];
  pacsByType: {
    traditional_pacs: Committee[];
    super_pacs: Committee[];
    leadership_pacs: Committee[];
    corporate_pacs: Committee[];
    other_committees: Committee[];
  };
}

interface Company {
  name: string;
  type: string; // 'LinkedIn Company' or 'Corporate PAC Sponsor'
  industry: string;
  size: string;
  website?: string;
  location?: string;
  country: string;
  relevance_score?: number;
  connection_type: string;
  total_contributions?: number;
}

interface Industry {
  industry: string;
  companies: Company[];
  totalContributions: number;
  connectionCount: number;
}

interface IndustryData {
  industries: Industry[];
  corporateConnections: Company[];
}

const Politician = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [congressman, setCongressman] = useState<Congressman | null>(null);

  const [committeeData, setCommitteeData] = useState<CommitteeData | null>(null);
  const [industryData, setIndustryData] = useState<IndustryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCommittees, setIsLoadingCommittees] = useState(true);

  const [isLoadingIndustries, setIsLoadingIndustries] = useState(true);
  const [isLoadingVotes, setIsLoadingVotes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [voteInfo, setVoteInfo] = useState<VoteInfo | null>(null);
  const [committeesError, setCommitteesError] = useState<string | null>(null);
  const [industriesError, setIndustriesError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [testStatus, setTestStatus] = useState<{
    loading: boolean;
    success: boolean | null;
    message: string;
    data: any;
  }>({
    loading: false,
    success: null,
    message: '',
    data: null
  });

  // Helper function to get badge color for PAC types
  const getPacTypeBadgeColor = (pacType: string, isCorpoate: boolean) => {
    if (isCorpoate) return 'orange';
    switch (pacType) {
      case 'N':
      case 'Q':
        return 'blue'; // Traditional PACs
      case 'O':
        return 'red'; // Super PACs
      case 'V':
      case 'W':
        return 'purple'; // Leadership PACs
      default:
        return 'gray';
    }
  };

  // Helper function to get PAC type display name
  const getPacTypeDisplayName = (pacType: string, isCorpoate: boolean) => {
    if (isCorpoate) return 'Corporate PAC';
    switch (pacType) {
      case 'N':
        return 'Nonconnected PAC';
      case 'Q':
        return 'Qualified PAC';
      case 'O':
        return 'Super PAC';
      case 'V':
        return 'Leadership PAC';
      case 'W':
        return 'Leadership PAC';
      default:
        return pacType;
    }
  };

   // Format currency
   const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Function to fetch most recent House vote
  const fetchMostRecentVote = async () => {
    try {
      const apiKey = import.meta.env.VITE_CONGRESS_API_KEY;
      if (!apiKey) {
        throw new Error('Congress.gov API key is not set in environment variables');
      }

      console.log('Starting to fetch 2 most recent votes...');

      // First get the most recent votes
      const voteResponse = await fetch(
        `https://api.congress.gov/v3/house-vote?api_key=${apiKey}&format=json&congress=119&limit=50`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!voteResponse.ok) {
        throw new Error(`Failed to fetch most recent votes: ${voteResponse.status}`);
      }

      const voteData = await voteResponse.json();
      console.log('Raw vote data:', JSON.stringify(voteData, null, 2));

      const recentVotes = voteData.houseRollCallVotes;
      console.log('All votes:', recentVotes.map((v: {
        startDate: string;
        question: string;
        rollCallNumber: number;
      }) => ({
        date: v.startDate,
        question: v.question,
        rollCall: v.rollCallNumber
      })));

      if (!recentVotes?.length) {
        throw new Error('No votes found in response');
      }

      // Sort votes by date, most recent first
      const sortedVotes = [...recentVotes].sort((a, b) =>
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      console.log('Sorted votes by date:', sortedVotes.map((v: {
        startDate: string;
        question: string;
        rollCallNumber: number;
      }) => ({
        date: v.startDate,
        question: v.question,
        rollCall: v.rollCallNumber
      })));

      // Take only the 3 most recent votes
      const mostRecentVotes = sortedVotes.slice(0, 3);
      console.log('Most recent 3 votes:', mostRecentVotes.map((v: {
        startDate: string;
        question: string;
        rollCallNumber: number;
      }) => ({
        date: v.startDate,
        question: v.question,
        rollCall: v.rollCallNumber
      })));

      // Process each vote
      const processedVotes = await Promise.all(mostRecentVotes.map(async (vote: {
        congress: number;
        sessionNumber: number;
        rollCallNumber: number;
        legislationType: string;
        legislationNumber: number;
        result: string;
        startDate: string;
        question: string;
        billInfo?: {
          title?: string;
          shortTitle?: string;
          latestAction?: string;
          policyArea?: string;
        };
      }) => {
        console.log('Processing vote:', vote);

        // Fetch bill title and subjects
        const [billTitleResponse, subjectsResponse] = await Promise.all([
          fetch(
            `https://api.congress.gov/v3/bill/${vote.congress}/${vote.legislationType.toLowerCase()}/${vote.legislationNumber}/titles?api_key=${apiKey}&format=json`,
            {
              headers: {
                'Accept': 'application/json'
              }
            }
          ),
          fetch(
            `https://api.congress.gov/v3/bill/${vote.congress}/${vote.legislationType.toLowerCase()}/${vote.legislationNumber}/subjects?api_key=${apiKey}&format=json`,
            {
              headers: {
                'Accept': 'application/json'
              }
            }
          )
        ]);

        if (!billTitleResponse.ok) {
          console.error(`Failed to fetch bill title for vote ${vote.rollCallNumber}`);
          return null;
        }

        const billTitleData = await billTitleResponse.json();
        const subjectsData = await subjectsResponse.json();
        console.log('Bill title data:', billTitleData);
        console.log('Subjects data:', subjectsData);

        const displayTitle = billTitleData.titles?.find((title: any) => title.titleType === "Display Title")?.title ||
          `${vote.legislationType}${vote.legislationNumber}`;
        const policyArea = subjectsData.subjects?.policyArea?.name;
        const legislativeSubjects = subjectsData.subjects?.legislativeSubjects?.map((subject: any) => subject.name)?.slice(0, 8) || [];
        console.log('Display title:', displayTitle);
        console.log('Policy area:', policyArea);
        console.log('Legislative subjects:', legislativeSubjects);

        // Get member votes for this specific vote
        const membersResponse = await fetch(
          `https://api.congress.gov/v3/house-vote/${vote.congress}/${vote.sessionNumber}/${vote.rollCallNumber}/members?api_key=${apiKey}&format=json`,
          {
            headers: {
              'Accept': 'application/json'
            }
          }
        );

        if (!membersResponse.ok) {
          console.error(`Failed to fetch member votes for vote ${vote.rollCallNumber}`);
          return null;
        }

        const membersData = await membersResponse.json();
        console.log('Raw members data:', JSON.stringify(membersData, null, 2));

        // Try different possible paths to find member votes
        const possiblePaths = [
          membersData.houseRollCallMemberVotes?.[0]?.members,
          membersData.houseRollCallVoteMemberVotes?.results,
          membersData.results,
          membersData.members
        ];


        // Find the first non-empty array
        const memberVotes = possiblePaths.find(arr => Array.isArray(arr) && arr.length > 0) || [];


        // Find this congressman's vote
        const congressmanVote = memberVotes.find(
          (member: any) => {

            return member.bioguideID === congressman?.bioguide_id;
          }
        );


        const voteCast = congressmanVote?.voteCast;


        const voteResult = {
          congress: vote.congress,
          session: vote.sessionNumber,
          voteNumber: vote.rollCallNumber,
          legislation: displayTitle,
          result: vote.result,
          date: vote.startDate,
          question: vote.question,
          voteCast: voteCast,
          billInfo: {
            title: displayTitle,
            policyArea: policyArea,
            legislativeSubjects: legislativeSubjects
          }
        };
        console.log('Final vote result object:', voteResult);

        return voteResult;
      }));

      // Filter out any null results and set the vote info
      const validVotes = processedVotes.filter(vote => vote !== null);
      console.log('Valid votes:', validVotes);

      const voteResult = { votes: validVotes };
      console.log('Final vote result:', voteResult);

      setVoteInfo(voteResult);
      return voteResult;
    } catch (error) {
      console.error('Error in fetchMostRecentVote:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
      return null;
    }
  };

  // Separate useEffect for fetching votes
  useEffect(() => {
    console.log('Component mounted - fetching votes');
    if (congressman?.bioguide_id) {
      console.log('Fetching votes for congressman:', congressman.bioguide_id);
      setIsLoadingVotes(true);
      fetchMostRecentVote().then(result => {
        if (result) {
          console.log('Successfully fetched vote and member data:', result);
          console.log('Setting voteInfo with:', result);
        }
        setIsLoadingVotes(false);
      }).catch(error => {
        console.error('Error fetching votes:', error);
        setIsLoadingVotes(false);
      });
    } else {
      console.log('No congressman bioguide_id available yet');
    }
  }, [congressman?.bioguide_id]);

  // Initialize chat messages when congressman data is loaded
  useEffect(() => {
    if (congressman && messages.length === 0) {
      setMessages([
        {
          role: 'assistant' as const,
          content: `Hi there! I'm your AI assistant. I can help answer questions about ${congressman.name}'s campaign financing and political background. What would you like to know?`
        }
      ]);
    }
  }, [congressman, messages.length]);

  // Fetch congressman details
  useEffect(() => {
    const fetchCongressmanDetails = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/congressman/${id}`, {
          headers: {
            'x-api-key': import.meta.env.VITE_CONGRESS_API_KEY || ''
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch congressman details');
        }
        const data = await response.json();
        setCongressman(data);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setIsLoading(false);
      }
    };

    fetchCongressmanDetails();
  }, [id]);

  // Add this function before the Politician component
  const classifyIndustry = (companyName: string): string => {
    const name = companyName.toUpperCase();
    
    // Political and Consulting
    if (name.includes('POLITICAL') || name.includes('STRATEGIES') || 
        name.includes('OUTREACH') || name.includes('MESSAGE') || 
        name.includes('CONSULTING') || name.includes('CONSULTANTS')) {
      return 'Political Consulting';
    }
    
    // Data and Technology
    if (name.includes('DATA') || name.includes('ANALYTICS') || 
        name.includes('CLOUD') || name.includes('SOFTWARE') || 
        name.includes('TECH') || name.includes('DIGITAL')) {
      return 'Data & Technology';
    }
    
    // Marketing and Media
    if (name.includes('MARKETING') || name.includes('ADVERTISING') || 
        name.includes('CREATIVE') || name.includes('MEDIA')) {
      return 'Marketing & Media';
    }
    
    // Printing and Publishing
    if (name.includes('PRINTING') || name.includes('MAIL') || 
        name.includes('PUBLISHING')) {
      return 'Printing & Publishing';
    }
    
    // Political Organizations
    if (name.includes('FUND') || name.includes('ACTION') || 
        name.includes('COMMITTEE') || name.includes('PAC')) {
      return 'Political Organization';
    }
    
    // Legal Services
    if (name.includes('LAW') || name.includes('ATTORNEY') || 
        name.includes('LEGAL')) {
      return 'Legal Services';
    }
    
    // Healthcare
    if (name.includes('HEALTH') || name.includes('MEDICAL') || 
        name.includes('PHARMACEUTICAL')) {
      return 'Healthcare';
    }
    
    // Financial Services
    if (name.includes('BANK') || name.includes('FINANCE') || 
        name.includes('INVESTMENT')) {
      return 'Financial Services';
    }
    
    // Insurance
    if (name.includes('INSURANCE')) {
      return 'Insurance';
    }
    
    // Real Estate
    if (name.includes('REAL ESTATE') || name.includes('PROPERTY')) {
      return 'Real Estate';
    }
    
    // Construction
    if (name.includes('CONSTRUCTION') || name.includes('BUILDING')) {
      return 'Construction';
    }
    
    // Energy
    if (name.includes('ENERGY') || name.includes('OIL') || 
        name.includes('GAS')) {
      return 'Energy';
    }
    
    // Utilities
    if (name.includes('UTILITY') || name.includes('ELECTRIC')) {
      return 'Utilities';
    }
    
    // Telecommunications
    if (name.includes('TELECOM') || name.includes('COMMUNICATIONS')) {
      return 'Telecommunications';
    }
    
    // Retail
    if (name.includes('RETAIL') || name.includes('STORE')) {
      return 'Retail';
    }
    
    // Restaurant and Hospitality
    if (name.includes('RESTAURANT') || name.includes('HOTEL') || 
        name.includes('HOSPITALITY') || name.includes('SCHNEIDER')) {
      return 'Restaurant & Hospitality';
    }
    
    // Food and Beverage
    if (name.includes('FOOD') || name.includes('BEVERAGE')) {
      return 'Food & Beverage';
    }
    
    // Beverages and Alcohol
    if (name.includes('ALCOHOL') || name.includes('WINE') || 
        name.includes('BEER') || name.includes('SPIRITS') || 
        name.includes('SAZERAC')) {
      return 'Beverages & Alcohol';
    }
    
    // Transportation
    if (name.includes('TRANSPORTATION') || name.includes('RAILROAD') || 
        name.includes('AIRLINE')) {
      return 'Transportation';
    }
    
    // Defense and Aerospace
    if (name.includes('DEFENSE') || name.includes('AEROSPACE')) {
      return 'Defense & Aerospace';
    }
    
    // Manufacturing
    if (name.includes('MANUFACTURING') || name.includes('INDUSTRIAL')) {
      return 'Manufacturing';
    }
    
    // Agriculture
    if (name.includes('AGRICULTURE') || name.includes('FARMING')) {
      return 'Agriculture';
    }
    
    // Mining and Natural Resources
    if (name.includes('MINING') || name.includes('NATURAL RESOURCES')) {
      return 'Mining & Natural Resources';
    }
    
    // Education
    if (name.includes('EDUCATION') || name.includes('UNIVERSITY') || 
        name.includes('COLLEGE')) {
      return 'Education';
    }
    
    // Non-Profit
    if (name.includes('NONPROFIT') || name.includes('FOUNDATION') || 
        name.includes('CHARITY')) {
      return 'Non-Profit';
    }
    
    // Professional Services (for companies with LLC, INC, CORP)
    if (name.includes('LLC') || name.includes('INC') || name.includes('CORP')) {
      return 'Professional Services';
    }
    
    // Default category
    return 'Political Services';
  };

  // Update the fetchIndustryData function
  const fetchIndustryData = async () => {
    if (!id) return;
    
    try {
      setIsLoadingIndustries(true);
      console.log('Fetching industry data for senator ID:', id);
      
      const response = await fetch(`http://localhost:3001/api/senator/${id}/industries`);
      const data = await response.json();
      
      console.log('Received industry data:', data);
      
      // Create a map to group companies by industry
      const industryMap = new Map<string, Industry>();
      
      // Process each company and classify its industry
      data.corporateConnections?.forEach((company: any) => {
        const industry = classifyIndustry(company.name);
        
        if (!industryMap.has(industry)) {
          industryMap.set(industry, {
            industry: industry,
            companies: [],
            totalContributions: 0,
            connectionCount: 0
          });
        }
        
        const industryData = industryMap.get(industry)!;
        industryData.companies.push({
          name: company.name,
          type: company.type || 'Corporate PAC Sponsor',
          industry: industry,
          size: company.size || 'Unknown',
          website: company.website,
          location: company.location,
          country: company.country || 'US',
          relevance_score: company.relevance_score,
          connection_type: company.connection_type,
          total_contributions: company.total_contributions || 0
        });
        industryData.totalContributions += company.total_contributions || 0;
        industryData.connectionCount += 1;
      });
      
      // Convert map to array and sort by total contributions
      const industries = Array.from(industryMap.values())
        .sort((a, b) => b.totalContributions - a.totalContributions);
      
      const transformedData = {
        industries: industries,
        corporateConnections: data.corporateConnections || []
      };
      
      console.log('Transformed industry data:', transformedData);
      setIndustryData(transformedData);
    } catch (err) {
      console.error('Error fetching industry data:', err);
      setIndustriesError(err instanceof Error ? err.message : 'Failed to fetch industry data');
    } finally {
      setIsLoadingIndustries(false);
    }
  };

  // Fetch committee contributions using new money tracking endpoint
  useEffect(() => {
    const fetchCommitteeData = async () => {
      if (!id) return;
      
      try {
        setIsLoadingCommittees(true);
        console.log('Fetching committee data for senator ID:', id);
        
        const response = await fetch(`http://localhost:3001/api/senator/${id}/committees`);
        const data = await response.json();
        
        console.log('Received committee data:', data);
        
        // Transform the data to match our frontend structure
        const transformedData = {
          totalContributions: data.totalContributions || 0,
          totalCommittees: data.totalCommittees || 0,
          committees: data.committees || [],
          pacsByType: data.pacsByType || {
            traditional_pacs: [],
            super_pacs: [],
            leadership_pacs: [],
            corporate_pacs: [],
            other_committees: []
          }
        };
        
        setCommitteeData(transformedData);
      } catch (err) {
        console.error('Error fetching committee data:', err);
        setCommitteesError(err instanceof Error ? err.message : 'Failed to fetch committee data');
      } finally {
        setIsLoadingCommittees(false);
      }
    };

    fetchCommitteeData();
  }, [id]);

  // Fetch industry data using new money tracking endpoint
  useEffect(() => {
    const fetchIndustryData = async () => {
      if (!id) return;
      
      try {
        setIsLoadingIndustries(true);
        console.log('Fetching industry data for senator ID:', id);
        
        const response = await fetch(`http://localhost:3001/api/senator/${id}/industries`);
        const data = await response.json();
        
        console.log('Received industry data:', data);
        
        // Create a map to group companies by industry
        const industryMap = new Map<string, Industry>();
        
        // Process each company and classify its industry
        data.corporateConnections?.forEach((company: any) => {
          const industry = classifyIndustry(company.name);
          
          if (!industryMap.has(industry)) {
            industryMap.set(industry, {
              industry: industry,
              companies: [],
              totalContributions: 0,
              connectionCount: 0
            });
          }
          
          const industryData = industryMap.get(industry)!;
          industryData.companies.push({
            name: company.name,
            type: company.type || 'Corporate PAC Sponsor',
            industry: industry,
            size: company.size || 'Unknown',
            website: company.website,
            location: company.location,
            country: company.country || 'US',
            relevance_score: company.relevance_score,
            connection_type: company.connection_type,
            total_contributions: company.total_contributions || 0
          });
          industryData.totalContributions += company.total_contributions || 0;
          industryData.connectionCount += 1;
        });
        
        // Convert map to array and sort by total contributions
        const industries = Array.from(industryMap.values())
          .sort((a, b) => b.totalContributions - a.totalContributions);
        
        const transformedData = {
          industries: industries,
          corporateConnections: data.corporateConnections || []
        };
        
        console.log('Transformed industry data:', transformedData);
        setIndustryData(transformedData);
      } catch (err) {
        console.error('Error fetching industry data:', err);
        setIndustriesError(err instanceof Error ? err.message : 'Failed to fetch industry data');
      } finally {
        setIsLoadingIndustries(false);
      }
    };

    fetchIndustryData();
  }, [id]);

  // Add effect to scroll to bottom of messages
  useEffect(() => {
    // Only scroll if we have more than the initial welcome message
    if (messages.length > 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (isLoading) {
    return (
      <Container maxW="container.xl" py={8}>
        <Center h="60vh">
          <Spinner size="xl" />
        </Center>
      </Container>
    );
  }


  if (error) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={4} align="stretch">
          <Button
            leftIcon={<ArrowBackIcon />}
            onClick={() => navigate('/profile')}
            colorScheme="blue"
            width="fit-content"

          >
            Back to Politicians
          </Button>
          <Center h="60vh">
            <Text color="red.500">Error: {error}</Text>
          </Center>
        </VStack>
      </Container>
    );
  }

  if (!congressman) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={4} align="stretch">
          <Button
            leftIcon={<ArrowBackIcon />}
            onClick={() => navigate('/profile')}
            colorScheme="blue"
            width="fit-content"
          >
            Back to Politicians
          </Button>
          <Center h="60vh">
            <Text>Politician not found</Text>
          </Center>
        </VStack>
      </Container>
    );
  }
  console.log(congressman)
  return (
    <Container maxW="container.xl" py={8}>
      <VStack align="stretch" spacing={6}>
        <Button
          leftIcon={<ArrowBackIcon />}
          onClick={() => navigate('/profile')}
          colorScheme="blue"
          width="fit-content"
        >
          Back to Politicians
        </Button>

        {/* Congressman Banner */}
        {congressman && (
          <CongressmanBanner
            name={congressman.name}
            party={congressman.party}
            state={congressman.state}
            image={congressman.image}
          />
        )}


        {/* Recent Vote Information */}
        <RecentVoteInfo
          voteInfo={voteInfo}
          congressmanId={congressman?.bioguide_id || ""}
          isLoading={isLoadingVotes}
        />

        {/* Main Content Grid */}
        <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={8}>
          {/* Left Column */}
          <VStack spacing={8}>
            {/* Committees Section */}
            <Box
              bg="white"
              p={6}
              borderRadius="xl"
              boxShadow="md"
              width="100%"
              minHeight="400px"
            >
              <Heading size="lg" mb={4}>AFFILIATED COMMITTEES</Heading>
              
              {/* Summary Stats */}
              <StatGroup mb={6}>
                <Stat>
                  <StatLabel>Total Committee Contributions</StatLabel>
                  <StatNumber>{formatCurrency(committeeData?.totalContributions || 0)}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Total Committees</StatLabel>
                  <StatNumber>{committeeData?.totalCommittees || 0}</StatNumber>
                </Stat>
              </StatGroup>
              
              {isLoadingCommittees ? (
                <Center p={8}>
                  <Spinner />
                </Center>
              ) : committeesError ? (
                <Text color="red.500">{committeesError}</Text>
              ) : !committeeData || committeeData.totalCommittees === 0 ? (
                <Flex direction="column" align="center" justify="center" p={8}>
                  <Text color="gray.500" fontSize="lg" mb={2}>No committee contributions found for this politician.</Text>
                  <Text color="gray.400" fontSize="sm">This could be because the politician is new or their data is not yet in our database.</Text>
                </Flex>
              ) : (
                <Box overflowX="auto">
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th>Committee Name</Th>
                        <Th>Type</Th>
                        <Th>Party</Th>
                        <Th isNumeric>Amount</Th>
                        <Th>Years</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {committeeData.committees.slice(0, 10).map((committee, index) => (
                        <Tr key={index}>
                          <Td>
                            <VStack align="start" spacing={1}>
                              <Text fontWeight="medium" fontSize="sm">{committee.name}</Text>
                              {committee.connected_organization && (
                                <Text fontSize="xs" color="gray.500">
                                  Connected: {committee.connected_organization}
                                </Text>
                              )}
                            </VStack>
                          </Td>
                          <Td>
                            <Badge colorScheme={getPacTypeBadgeColor(committee.pac_type, committee.is_corporate_pac)}>
                              {getPacTypeDisplayName(committee.pac_type, committee.is_corporate_pac)}
                            </Badge>
                          </Td>
                          <Td>
                            <Text fontSize="xs">{committee.party_affiliation || 'N/A'}</Text>
                          </Td>
                          <Td isNumeric fontWeight="bold">
                            {formatCurrency(committee.total_contributions)}
                          </Td>
                          <Td>
                            <Text fontSize="xs">
                              {committee.years?.length > 0 ? committee.years.join(', ') : 'N/A'}
                            </Text>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              )}
            </Box>

            {/* Industries Box */}
            <Box
              bg="white"
              p={6}
              borderRadius="xl"
              boxShadow="md"
              width="100%"
              minHeight="400px"
            >
              <Heading size="lg" mb={4}>INDUSTRIES</Heading>
              
              {isLoadingIndustries ? (
                <Center p={8}>
                  <Spinner />
                </Center>
              ) : industriesError ? (
                <Text color="red.500">{industriesError}</Text>
              ) : !industryData || industryData.industries.length === 0 ? (
                <Flex direction="column" align="center" justify="center" p={8}>
                  <Text color="gray.500" fontSize="lg" mb={2}>No industry connections found for this politician.</Text>
                  <Text color="gray.400" fontSize="sm">This could be because the politician is new or their data is not yet in our database.</Text>
                </Flex>
              ) : (
                <Accordion allowMultiple>
                  {industryData.industries.slice(0, 5).map((industry, index) => (
                    <AccordionItem key={index}>
                      <AccordionButton>
                        <Box flex="1" textAlign="left">
                          <HStack justify="space-between">
                            <Text fontWeight="medium">{industry.industry}</Text>
                            <Badge colorScheme="blue">{industry.connectionCount} companies</Badge>
                          </HStack>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel pb={4}>
                        <VStack align="stretch" spacing={3}>
                          {industry.companies.slice(0, 3).map((company, companyIndex) => (
                            <Box key={companyIndex} p={3} bg="gray.50" borderRadius="md">
                              <VStack align="start" spacing={2}>
                                <HStack justify="space-between" w="100%">
                                  <Text fontWeight="medium" fontSize="sm">{company.name}</Text>
                                  <Badge colorScheme={company.type === 'LinkedIn Company' ? 'green' : 'orange'}>
                                    {company.type}
                                  </Badge>
                                </HStack>
                                
                                <HStack spacing={4} fontSize="xs" color="gray.600">
                                  {company.size && <Text>Size: {company.size}</Text>}
                                  {company.location && <Text>Location: {company.location}</Text>}
                                </HStack>
                                
                                {company.total_contributions && company.total_contributions > 0 && (
                                  <Text fontWeight="bold" color="green.600" fontSize="sm">
                                    Contributions: {formatCurrency(company.total_contributions)}
                                  </Text>
                                )}
                                
                                {company.website && (
                                  <Link href={company.website} isExternal color="blue.500" fontSize="xs">
                                    Visit Website <ExternalLinkIcon mx="2px" />
                                  </Link>
                                )}
                              </VStack>
                            </Box>
                          ))}
                        </VStack>
                      </AccordionPanel>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </Box>
          </VStack>

         {/* Right Column - ChatBot */}
         <Box
            bg="white"
            p={6}
            borderRadius="xl"
            boxShadow="md"
            height="fit-content"
            position="sticky"
            top="20px"
          >
            <Heading size="md" mb={4}>Ask about Campaign Finance</Heading>
            <ChatBot />
          </Box>
        </Grid>

      </VStack>


</Container>

    
  );
};

export default Politician;
