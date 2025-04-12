// src/pages/Explore.tsx
import { 
    Container, 
    Heading, 
    Input, 
    SimpleGrid, 
    Card, 
    CardBody, 
    CardHeader,
    CardFooter,
    Text,
    Select,
    HStack
  } from '@chakra-ui/react';
  import { useState } from 'react';
  
  const Explore = () => {
    const [searchTerm, setSearchTerm] = useState('');
  
    return (
      <Container maxW="container.xl" py={8}>
        <Heading mb={6}>Explore Political Contributions</Heading>
        
        <HStack  mb={8}>
          <Input
            placeholder="Search politicians or PACs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="lg"
          />
        </HStack>
  
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }}>
          {/* Example cards 
          <Card>
            <CardBody>
              <Heading size="md">Bernie Sanders</Heading>
              <Text>Party: Democratic</Text>
              <Text>Total Raised: $20M</Text>
            </CardBody>
          </Card>*/}
          {/* Add more cards */}
        </SimpleGrid>
      </Container>
    );
  };
  
  export default Explore;