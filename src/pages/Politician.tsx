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

interface Senator {
  id: number;
  name: string;
  state: string;
  party: string;
  chamber: string;
  image: string; 
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

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const Politician = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [senator, setSenator] = useState<Senator | null>(null);
  const [committeeData, setCommitteeData] = useState<CommitteeData | null>(null);
  const [industryData, setIndustryData] = useState<IndustryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCommittees, setIsLoadingCommittees] = useState(true);
  const [isLoadingIndustries, setIsLoadingIndustries] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [committeesError, setCommitteesError] = useState<string | null>(null);
  const [industriesError, setIndustriesError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat messages when senator data is loaded
  useEffect(() => {
    if (senator && messages.length === 0) {
      setMessages([
        { 
          role: 'assistant' as const, 
          content: `Hi there! I'm your AI assistant. I can help answer questions about ${senator.name}'s campaign financing and political background. What would you like to know?` 
        }
      ]);
    }
  }, [senator, messages.length]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Fetch senator details
  useEffect(() => {
    const fetchSenatorDetails = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching senator with ID:', id);
        
        if (!id) {
          throw new Error('No politician ID provided');
        }
  
        // Convert id to number
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
          throw new Error('Invalid ID format');
        }
  
        // Fetch the senator data
        const response = await fetch(`http://localhost:3001/api/senator/${numericId}`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const data = await response.json();
        console.log('Received senator data:', data);
        
        if (!data || !data.id) {
          throw new Error('Invalid senator data received');
        }
        
        setSenator(data);
      } catch (err) {
        console.error('Error fetching senator details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch senator details');
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchSenatorDetails();
  }, [id]);

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
        setCommitteeData(data);
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
        setIndustryData(data);
      } catch (err) {
        console.error('Error fetching industry data:', err);
        setIndustriesError(err instanceof Error ? err.message : 'Failed to fetch industry data');
      } finally {
        setIsLoadingIndustries(false);
      }
    };

    fetchIndustryData();
  }, [id]);

  // Add a function to handle sending messages
  const handleSendMessage = async () => {
    if (!userInput.trim() || !senator) return;
    
    // Add user message
    const newMessages = [...messages, { role: 'user' as const, content: userInput.trim() }];
    setMessages(newMessages);
    setUserInput('');
    setIsTyping(true);
    
    try {
      // Call the server endpoint that will interact with Gemini API
      const response = await fetch('http://localhost:3001/api/gemini-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: userInput.trim(),
          context: {
            senator: {
              name: senator.name,
              party: senator.party,
              state: senator.state,
            },
            committeeData: committeeData,
            industryData: industryData
          },
          history: messages
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response from Gemini');
      }
      
      const data = await response.json();
      
      setMessages([...newMessages, { role: 'assistant' as const, content: data.response }]);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      setMessages([
        ...newMessages, 
        { 
          role: 'assistant' as const, 
          content: `I'm sorry, I encountered an error while processing your request. Please try again later.` 
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Add effect to scroll to bottom of messages
  useEffect(() => {
    // Only scroll if we have more than the initial welcome message
    if (messages.length > 1) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  if (!senator) {
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

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Button 
          leftIcon={<ArrowBackIcon />} 
          onClick={() => navigate('/profile')}
          colorScheme="blue"
          width="fit-content"
        >
          Back to Politicians
        </Button>
        
        {/* Top Banner */}
        <Box
          bg="white"
          p={6}
          borderRadius="xl"
          boxShadow="md"
          width="100%"
        >
          <Flex>
          <Image
            src={`http://localhost:3001/images/${senator.image}`}
            alt={senator.name}
            borderRadius="2xl"
            boxSize="100px"
            objectFit="cover"
            fallbackSrc="https://i.imgur.com/VlKTQWO.png"
          />
            <VStack align="flex-start" ml={8} spacing={2}>
              <Heading size="xl">{senator.name}</Heading>
              <Text fontSize="lg" color="gray.600">
                {senator.party} - {senator.state}
             </Text>
            </VStack>
          </Flex>
        </Box>

        {/* Two Column Layout */}
        <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={8}>
          {/* Left Column */}
          <VStack spacing={8}>
            {/* Affiliated Committees Box */}
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
                              {committee.years.length > 0 ? committee.years.join(', ') : 'N/A'}
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

          {/* Right Column - Chat Box */}
          <Box
            bg="white"
            p={6}
            borderRadius="xl"
            boxShadow="md"
            width="100%"
            height="850px"
            display="flex"
            flexDirection="column"
          >
            <Heading size="lg" mb={4}>AI Analysis</Heading>
            
            {/* Messages Container */}
            <Box 
              flex="1" 
              overflowY="auto" 
              mb={4} 
              css={{
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  width: '10px',
                  background: '#f1f1f1',
                  borderRadius: '24px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: '#c5c5c5',
                  borderRadius: '24px',
                },
              }}
            >
              {messages.map((message, index) => (
                <Flex
                  key={index}
                  mb={4}
                  alignItems="flex-start"
                  flexDirection={message.role === 'user' ? 'row-reverse' : 'row'}
                >
                  <Avatar 
                    size="sm" 
                    name={message.role === 'user' ? 'You' : 'Gemini'} 
                    bg={message.role === 'user' ? 'blue.500' : 'red.500'} 
                    mr={message.role === 'user' ? 0 : 2}
                    ml={message.role === 'user' ? 2 : 0}
                  />
                  <Box
                    bg={message.role === 'user' ? 'blue.100' : 'gray.100'}
                    p={3}
                    borderRadius="lg"
                    maxWidth="75%"
                  >
                    <Text>{message.content}</Text>
                  </Box>
                </Flex>
              ))}
              <div ref={messagesEndRef} />
            </Box>
            
            {/* Input Area */}
            <Divider mb={4} />
            {isTyping && (
              <Text fontSize="sm" color="gray.500" mb={2}>
                Gemini is typing...
              </Text>
            )}
            <Flex>
              <Input
                placeholder="Ask a question about this politician..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                mr={2}
              />
              <IconButton
                aria-label="Send message"
                icon={<ArrowForwardIcon />}
                colorScheme="blue"
                onClick={handleSendMessage}
                isDisabled={isTyping || !userInput.trim()}
              />
            </Flex>
          </Box>
        </Grid>
      </VStack>
    </Container>
  );
};

export default Politician;