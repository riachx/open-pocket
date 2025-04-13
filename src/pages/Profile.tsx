// src/pages/Profile.tsx
import { useState, useEffect } from 'react';
import { 
  Container, SimpleGrid, Box, Image, Text, VStack, Spinner, Center,
  Input, InputGroup, InputLeftElement, Button, Heading, Flex
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { motion } from 'framer-motion';

// Create motion components
const MotionBox = motion(Box);
const MotionFlex = motion(Flex);
const MotionSimpleGrid = motion(SimpleGrid);

interface Senator {
  id: number;
  name: string;
  party: string;
  state: string;
  photoUrl?: string;
  phones?: string[];
}

const Profile = () => {
  const [senators, setSenators] = useState<Senator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  useEffect(() => {
    const fetchSenators = async () => {
      try {
        console.log('Fetching senators...');
        const response = await fetch('http://localhost:3001/api/senators');
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received data:', data);
        setSenators(data);
      } catch (err) {
        console.error('Error fetching senators:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch senators');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSenators();
  }, []);

  const filteredSenators = senators.filter(senator => 
    senator.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <MotionBox
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Hero Banner */}
      <MotionBox 
        backgroundImage="/american-flag-bg.png"
        backgroundSize="cover"
        backgroundPosition="center"
        borderRadius="40"
        m={6}
        p={12}
        height="200px"
        position="relative"
        variants={itemVariants}
      >
        <Heading 
          as="h1" 
          size="4xl" 
          color="white" 
          fontWeight="bold"
          marginTop={2}
          letterSpacing="tighter"
        >
          Politicians
        </Heading>
      </MotionBox>

      {/* Search Section */}
      <MotionFlex 
        wrap="wrap" 
        justify="space-between" 
        align="center" 
        p={4}
        bg="gray.100"
        m={4}
        borderRadius="40"
        variants={itemVariants}
      >
        <Box 
          p={4}
          fontWeight="medium"
          fontSize="3xl"
          minW="200px"
          letterSpacing="tight"
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
      </MotionFlex>

      {/* Senators Grid */}
      <MotionBox 
        bg="gray.100" 
        mx={4} 
        borderRadius="40" 
        p={6}
        variants={itemVariants}
      >
        <MotionSimpleGrid 
          columns={{ base: 4, md: 6, lg: 8 }} 
          spacing={4}
          variants={containerVariants}
        >
          {filteredSenators.map((senator, index) => (
            <MotionBox
              key={senator.id}
              borderRadius="2xl"
              overflow="hidden"
              boxShadow="md"
              bg="white"
              p={3}
              mx="auto"
              variants={itemVariants}
              custom={index}
              initial="hidden"
              animate="visible"
              transition={{ delay: index * 0.05 }}
            >
              <VStack>
                <Image
                  src={senator.photoUrl || "https://i.imgur.com/VlKTQWO.png"}
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
            </MotionBox>
          ))}
        </MotionSimpleGrid>
      </MotionBox>
    </MotionBox>
  );
};

export default Profile;
