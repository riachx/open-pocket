import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
  HStack,
  Flex,
} from '@chakra-ui/react';

interface Senator {
  id: number;
  name: string;
  party: string;
  state: string;
  photoUrl?: string;
  phones?: string[];
}

const Politician = () => {
  const { id } = useParams();
  const [senator, setSenator] = useState<Senator | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSenatorDetails = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/senators');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const senators = await response.json();
        const foundSenator = senators.find((s: Senator) => s.id === Number(id));
        
        if (!foundSenator) {
          throw new Error('Senator not found');
        }
        
        setSenator(foundSenator);
      } catch (err) {
        console.error('Error fetching senator details:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch senator details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSenatorDetails();
  }, [id]);

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

  if (!senator) {
    return (
      <Center h="100vh">
        <Text>Politician not found</Text>
      </Center>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
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
              src={senator.photoUrl || "https://i.imgur.com/VlKTQWO.png"}
              alt={senator.name}
              boxSize="150px"
              objectFit="cover"
              borderRadius="xl"
            />
            <VStack align="flex-start" ml={8} spacing={2}>
              <Heading size="xl">{senator.name}</Heading>
              <Text fontSize="lg" color="gray.600">
                {senator.party} - {senator.state}
              </Text>
              {senator.phones && senator.phones.length > 0 && (
                <Text fontSize="md">Phone: {senator.phones[0]}</Text>
              )}
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
              height="400px"
            >
              <Heading size="lg" mb={4}>AFFILIATED PACS</Heading>
              <Text color="gray.500">PAC information will be added here...</Text>
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
          >
            <Heading size="lg" mb={4}>AI Analysis</Heading>
            <Text color="gray.500">Gemini agent chat will be integrated here...</Text>
          </Box>
        </Grid>
      </VStack>
    </Container>
  );
};

export default Politician;