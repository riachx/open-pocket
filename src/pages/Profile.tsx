// src/pages/Profile.tsx
import { useState, useEffect } from 'react';
import { 
  Container, SimpleGrid, Box, Image, Text, VStack, Spinner, Center,
  Input, InputGroup, InputLeftElement, Button, Heading, Flex
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { Link } from 'react-router-dom';

interface Senator {
  id: number;
  name: string;
  state: string;
  party: string;
  chamber: string;
  image: string; 
}

const Profile = () => {
  const [senators, setSenators] = useState<Senator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchSenators = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/members');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
        const data: Senator[] = await response.json();
        console.log('Fetched senators data:', data); // Add this line to see the data
        setSenators(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch senators');
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchSenators();
  }, []);

  const filteredSenators = senators
    .filter(s => s.chamber.toLowerCase() === 'senate')
    .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));


  if (isLoading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100vh">
        <Text color="red.500">Error: {error}</Text>
      </Center>
    );
  }

  if (!senators.length) {
    return (
      <Center h="100vh">
        <Text>No senators found</Text>
      </Center>
    );
  }

 
  return (
    <Box>
      {/* Hero Banner */}
      <Box 
        backgroundImage="/american-flag-bg.png"
        backgroundSize="cover"
        backgroundPosition="center"
        borderRadius="40"
        m={6}
        p={12}
        height="200px"
        position="relative"
      >
        <Heading 
          as="h1" 
          size="4xl" 
          color="white" 
          fontWeight="bold"
          marginTop={2}
          letterSpacing={"tighter"}
        >
          Politicians
        </Heading>
      </Box>

      {/* Search Section */}
      <Flex 
        wrap="wrap" 
        justify="space-between" 
        align="center" 
        p={4}
        bg="gray.100"
        m={4}
        borderRadius="40"
      >
        <Box 
          p={4}
          fontWeight="medium"
          fontSize="3xl"
          minW="200px"
        >
          Senators
        </Box>
        
        <Flex maxW="600px" flex={1} ml={4}>
          <InputGroup size="lg">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input 
              placeholder="Search for a Senator" 
              bg="white" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </InputGroup>
          <Button 
            colorScheme="red" 
            size="lg" 
            ml={2}
          >
            Search
          </Button>
        </Flex>
      </Flex>

      {/* Senators Grid */}
      <Box bg="gray.100" mx={4} borderRadius="40" p={6}>
      <SimpleGrid columns={{ base: 4, md: 6, lg: 8 }} spacing={4}>
      {filteredSenators.map((senator) => (
        <Link 
        to={`/politician/${senator.id}`}  // Use the ID directly
          key={senator.id}  // Use ID as key
          style={{ textDecoration: 'none' }}
          
      >
          <Box
            borderRadius="2xl"
            overflow="hidden"
            boxShadow="md"
            bg="white"
            p={3}
            mx="auto"
            transition="transform 0.2s"
            _hover={{ transform: 'scale(1.02)', boxShadow: 'lg' }}
          >
            <VStack>
              <Image
                src={`http://localhost:3001/${senator.image}`}
                alt={senator.name}
                borderRadius="2xl"
                boxSize="100px"
                objectFit="cover"
                fallbackSrc="https://i.imgur.com/VlKTQWO.png"
              />
              <Text fontWeight="bold" textAlign="center" fontSize="sm">
                {senator.name}
              </Text>
              <Text fontSize="xs" color="gray.600">
                {senator.party} - {senator.state}
              </Text>
              
            </VStack>
          </Box>
        </Link>
      ))}
    </SimpleGrid>
      </Box>
    </Box>
  );
};

export default Profile;