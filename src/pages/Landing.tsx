// src/pages/Landing.tsx
import { Box, Container, Heading, Text, Button, VStack, Image } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

const Landing = () => {
  return (
    <Box
      h="calc(100vh - 80px)"
      position="relative"
      overflow="hidden"
      bg="white"
    >
      <Box
        position="absolute"
        top={{ base: '24px', md: '32px', lg: '40px' }}
        bottom={{ base: '24px', md: '32px', lg: '40px' }}
        left={{ base: '24px', md: '48px', lg: '64px' }}
        right={{ base: '24px', md: '48px', lg: '64px' }}
        borderRadius="40"
        overflow="hidden"
      >
        <Image
          src="/american-flag-bg.png"
          alt="American Flag"
          w="full"
          h="full"
          objectFit="cover"
          filter="brightness(0.7)"
        />
      </Box>
      <Container 
        maxW="container.xl" 
        h="full"
        position="relative"
        zIndex={1}
      >
        <VStack
          align="flex-start"
          justify="center"
          h="full"
          spacing={6}
          color="white"
          pl={{ base: '40px', md: '64px', lg: '80px' }}
        >
          <Heading
            as="h1"
            size="4xl"
            fontWeight="bold"
            letterSpacing="tight"
          >
            Govtruth.io
          </Heading>
          
          <Text
            fontSize="2xl"
            maxW="600px"
            lineHeight="1.4"
          >
            Because the financial interests of our leaders shouldn't be a secret.
          </Text>

          <Button
            as={Link}
            to="/explore"
            size="lg"
            bg="white"
            color="#1D2E93"
            px={8}
            _hover={{
              bg: 'gray.100'
            }}
            mt={4}
          >
            Explore →
          </Button>
        </VStack>
      </Container>
    </Box>
  );
};

export default Landing;