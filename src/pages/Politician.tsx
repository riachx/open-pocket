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

interface Senator {
  id: number;
  name: string;
  state: string;
  party: string;
  chamber: string;
  image: string; 
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
  const [senator, setSenator] = useState<Senator | null>(null);
  const [committees, setCommittees] = useState<CommitteeContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCommittees, setIsLoadingCommittees] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [committeesError, setCommitteesError] = useState<string | null>(null);
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
        console.log('Response status:', response.status); // Add this logging
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const data = await response.json();
        console.log('Received senator data:', data); // Add this logging
        
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

  // Fetch committee contributions
  useEffect(() => {
    const fetchCommitteeContributions = async () => {
      if (!id) return;
      
      try {
        setIsLoadingCommittees(true);
        console.log('Fetching committee contributions for politician ID:', id);
        
        let url = `http://localhost:3001/api/senators/${id}/committees`;
        
        // Special case for Tim Scott
        if (id === '1282') {
          console.log('Using special debug endpoint for Tim Scott');
          url = 'http://localhost:3001/api/tim-scott-debug';
        }
        
        // Use the direct endpoint for a specific senator
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
            committees: committees,
            totalContributions
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
            src={`http://localhost:3001/images/${senator.image}`}  // Make sure this matches your image path
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