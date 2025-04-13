// src/components/Footer.tsx
import { Box, Container, Stack, Text, Heading, Flex, Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

const Footer = () => {
  return (
    <Box
      as="footer"
      //bgGradient="linear(to-r, #BE2C47 0%, #BE2C47 0%, #1D2E93 24%, #0D1753 80%, #0D1753 100%)"
      bgColor="#EFEFEF"
      color="gray.800"
      py={8}
    >
      <Container maxW="container.xl">
        <Flex 
          direction="column"
          alignItems="center"
          justifyContent="center"
          textAlign="center"
          gap={1}
        >
          <Heading
            as="h2"
            fontSize="3xl"
            fontWeight="medium"
            mb={1}
            letterSpacing="tighter"
          >
            OpenPockets
          </Heading>
          
          <Flex gap={8}>
            <Link 
              as={RouterLink} 
              to="/about" 
              fontSize="md" 
              fontWeight="light"
              _hover={{ textDecoration: 'none', opacity: 0.8 }}
            >
              About
            </Link>
            <Link 
              as={RouterLink} 
              to="/profiles" 
              fontSize="md" 
              fontWeight="light"
              _hover={{ textDecoration: 'none', opacity: 0.8 }}
            >
              Profiles
            </Link>
            <Link 
              as={RouterLink} 
              to="/explore" 
              fontSize="md" 
              fontWeight="light"
              _hover={{ textDecoration: 'none', opacity: 0.8 }}
            >
              Explore
            </Link>
          </Flex>
        </Flex>
      </Container>
    </Box>
  );
};

export default Footer;