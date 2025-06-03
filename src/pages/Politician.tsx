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
} from '@chakra-ui/react';
import { ArrowBackIcon, ArrowForwardIcon } from '@chakra-ui/icons';
import ChatBot from '../components/ChatBot';

interface Congressman {
  id: number;
  name: string;
  state: string;
  party: string;
  chamber: string;
  image: string;
  congress: number;
}

interface CommitteeContribution {
  name: string;
  entity_type: string;
  total_amount: number;
  transaction_count: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const Politician = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [congressman, setCongressman] = useState<Congressman | null>(null);
  const [committees, setCommittees] = useState<CommitteeContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCommittees, setIsLoadingCommittees] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [committeesError, setCommitteesError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Fetch congressman details
  useEffect(() => {
    const fetchCongressmanDetails = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching congressman with ID:', id);
        
        if (!id) {
          throw new Error('No politician ID provided');
        }
  
        // Convert id to number
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
          throw new Error('Invalid ID format');
        }
  
        // Fetch the congressman data
        const response = await fetch(`http://localhost:3001/api/congressman/${numericId}`);
        console.log('Response status:', response.status); // Add this logging
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const data = await response.json();
        console.log('Received congressman data:', data); // Add this logging
        
        if (!data || !data.id) {
          throw new Error('Invalid congressman data received');
        }
        
        setCongressman(data);
      } catch (err) {
        console.error('Error fetching congressman details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch congressman details');
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchCongressmanDetails();
  }, [id]);

  // Fetch committee contributions
  useEffect(() => {
    const fetchCommitteeContributions = async () => {
      if (!id) return;
      
      try {
        setIsLoadingCommittees(true);
        console.log('Fetching committee contributions for politician ID:', id);
        
        let url = `http://localhost:3001/api/congressmen/${id}/committees`;
        
        
        // Use the direct endpoint for a specific congressman
        const response = await fetch(url);
        
        // Even if we get a 404 or 500, we'll still try to parse the response
        // This is to handle the case where the server returns an empty array
        const data = await response.json().catch(() => []);
        console.log('Received committee data:', data);
        
        // Extract contributions from debug endpoint if needed
        const contributionsData = id === '1282' && data.contributions ? data.contributions : data;
        
        // Ensure we have array data
        const contributions = Array.isArray(contributionsData) ? contributionsData : [];
        console.log('Found committee contributions:', contributions.length);
        
        setCommittees(contributions);
      } catch (err) {
        console.error('Error fetching committee contributions:', err);
        setCommitteesError(err instanceof Error ? err.message : 'Failed to fetch committee data');
        // Don't set empty array here to avoid losing data if it was loaded successfully before
      } finally {
        setIsLoadingCommittees(false);
      }
    };

    fetchCommitteeContributions();
  }, [id]);

  // Calculate total contributions
  const totalContributions = committees.reduce((sum, committee) => sum + committee.total_amount, 0);

  // Add a function to handle sending messages
  const handleSendMessage = async () => {
    if (!userInput.trim() || !congressman) return;
    
    // Add user message
    const newMessages = [...messages, { role: 'user' as const, content: userInput.trim() }];
    setMessages(newMessages);
    setUserInput('');
    setIsTyping(true);
    
    try {
      // Call the LangChain chat endpoint
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userInput.trim()
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response from chat endpoint');
      }
      
      const data = await response.json();
      
      setMessages([...newMessages, { role: 'assistant' as const, content: data.response }]);
    } catch (error) {
      console.error('Error calling chat endpoint:', error);
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

  return (
    <Container maxW="container.xl" py={8}>
      <Grid templateColumns={{ base: '1fr', md: '2fr 1fr' }} gap={8}>
        <VStack align="stretch" spacing={6}>
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
              src={`http://localhost:3001/${congressman.image}`}
              alt={congressman.name}
              borderRadius="2xl"
              boxSize="100px"
              objectFit="cover"
              fallbackSrc="https://i.imgur.com/VlKTQWO.png"
            />
              <VStack align="flex-start" ml={8} spacing={2}>
                <Heading size="xl">{congressman.name}</Heading>
                <Text fontSize="lg" color="gray.600">
                  {congressman.party} - {congressman.state}
               </Text>
              </VStack>
            </Flex>
          </Box>

          {/* Two Column Layout */}
          <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={8}>
            {/* Left Column */}
            <VStack spacing={8}>
              {/* Affiliated PACs Box */}
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
                    <StatNumber>{formatCurrency(totalContributions)}</StatNumber>
                  </Stat>
                  <Stat>
                    <StatLabel>Total Committees</StatLabel>
                    <StatNumber>{committees.length}</StatNumber>
                  </Stat>
                </StatGroup>
                
                {isLoadingCommittees ? (
                  <Center p={8}>
                    <Spinner />
                  </Center>
                ) : committeesError ? (
                  <Text color="red.500">{committeesError}</Text>
                ) : committees.length === 0 ? (
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
                          <Th isNumeric>Amount</Th>
                          <Th isNumeric>Transactions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {committees.map((committee, index) => (
                          <Tr key={index}>
                            <Td fontWeight="medium">{committee.name}</Td>
                            <Td>
                              <Badge colorScheme="purple">{committee.entity_type}</Badge>
                            </Td>
                            <Td isNumeric fontWeight="bold">{formatCurrency(committee.total_amount)}</Td>
                            <Td isNumeric>{committee.transaction_count}</Td>
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
                height="400px"
              >
                <Heading size="lg" mb={4}>INDUSTRIES</Heading>
                <Text color="gray.500">Industry information will be added here...</Text>
              </Box>
            </VStack>

            
          </Grid>
        </VStack>
        
        {/* Add ChatBot in the right column */}
        <Box>
          <Heading size="md" mb={4}>Ask about Campaign Finance</Heading>
          <ChatBot />
        </Box>
      </Grid>
    </Container>
  );
};

export default Politician;