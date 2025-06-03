// src/pages/Profile.tsx
import { useState, useEffect } from 'react';
import { 
  Container, SimpleGrid, Box, Image, Text, VStack, Spinner, Center,
  Input, InputGroup, InputLeftElement, Button, Heading, Flex
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { Link } from 'react-router-dom';

interface Congressman {
  id: number;
  name: string;
  state: string;
  party: string;
  chamber: string;
  image: string;
  congress: number;
}

// Helper function to format congressman name
const formatCongressmanName = (name: string): string => {
  // Check if the name contains a comma
  if (name.includes(',')) {
    const [lastName, firstName] = name.split(',').map(part => part.trim());
    return `${firstName} ${lastName}`;
  }
  return name;
};

// Helper function to format party name
const formatParty = (party: string): string => {
  const partyLower = party.toLowerCase();
  if (partyLower.includes('republican')) return 'R';
  if (partyLower.includes('democrat')) return 'D';
  return party;
};

const Profile = () => {
  const [congressmen, setCongressmen] = useState<Congressman[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchCongressmen = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/members');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
        const data: Congressman[] = await response.json();
        console.log('Fetched congressmen data:', data);
        setCongressmen(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch congressmen');
      } finally {
        setIsLoading(false);
      }
    };
  
    fetchCongressmen();
  }, []);

  const filteredCongressmen = congressmen
    .filter(c => c.congress > 100)
    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

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

  if (!congressmen.length) {
    return (
      <Center h="100vh">
        <Text>No congressmen found</Text>
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
        m={8}
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
        m={8}
        borderRadius="40"
      >
        <Box 
          p={4}
          fontWeight="medium"
          fontSize="3xl"
          minW="200px"
          letterSpacing={-1}
        >
          Members of Congress
        </Box>
        
        <Flex maxW="600px" flex={1} m={4}>
          <InputGroup size="lg">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input 
              placeholder="Search for a Congressman" 
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

      {/* Congressmen Grid */}
      <Box bg="gray.100" mx={8} borderRadius="40" p={8}>
        <SimpleGrid columns={{ base: 4, md: 6, lg: 8 }} spacing={4}>
          {filteredCongressmen.map((congressman) => (
            <Link 
              to={`/politician/${congressman.id}`}
              key={congressman.id}
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
                    src={`http://localhost:3001/${congressman.image}`}
                    alt={congressman.name}
                    borderRadius="2xl"
                    boxSize="100px"
                    objectFit="cover"
                    fallbackSrc="https://i.imgur.com/VlKTQWO.png"
                  />
                  <Text fontWeight="bold" textAlign="center" fontSize="sm">
                    {formatCongressmanName(congressman.name)}
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    {formatParty(congressman.party)} - {congressman.state}
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