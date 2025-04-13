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
  Divider,
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
        {/* Hero Section */}
        <Box
          bg="gray.100"
          borderRadius="40"
          overflow="hidden"
          position="relative"
          height="300px"
        >
          <Image
            src={senator.photoUrl || "https://i.imgur.com/VlKTQWO.png"}
            alt={senator.name}
            objectFit="cover"
            w="100%"
            h="100%"
            filter="brightness(0.7)"
          />
          <Box
            position="absolute"
            bottom="0"
            left="0"
            right="0"
            p={8}
            bg="rgba(0, 0, 0, 0.5)"
            color="white"
          >
            <Heading size="2xl">{senator.name}</Heading>
            <Text fontSize="xl">{senator.party} - {senator.state}</Text>
          </Box>
        </Box>

        {/* Contact Information */}
        <Box bg="white" p={6} borderRadius="xl" boxShadow="md">
          <Heading size="md" mb={4}>Contact Information</Heading>
          {senator.phones && senator.phones.length > 0 && (
            <Text>Phone: {senator.phones[0]}</Text>
          )}
        </Box>

        {/* Financial Analysis Section - Placeholder */}
        <Box bg="white" p={6} borderRadius="xl" boxShadow="md">
          <Heading size="md" mb={4}>Financial Analysis</Heading>
          <Text color="gray.500">
            Financial analysis report will be integrated here...
          </Text>
        </Box>
      </VStack>
    </Container>
  );
};

export default Politician;