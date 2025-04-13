
import { Box, Container, HStack, Link as ChakraLink, Button } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <Box py={4} borderBottom="1px" borderColor="gray.100">
      <Container maxW="container.xl">
        <HStack justify="space-between" align="center">
          <ChakraLink
            as={Link}
            to="/"
            fontSize="2xl"
            fontWeight="bold"
            _hover={{ textDecoration: 'none' }}
          >
            OpenSecrets
          </ChakraLink>

          <HStack spacing={8}>
            <ChakraLink as={Link} to="/about">
              About
            </ChakraLink>
            <ChakraLink as={Link} to="/profile">
              Profiles
            </ChakraLink>
            <ChakraLink as={Link} to="/explore">
              Explore
            </ChakraLink>
          </HStack>

          <HStack spacing={4}>
            <Button as={Link} to="/login" variant="ghost">
              Login
            </Button>
            <Button
              as={Link}
              to="/get-started"
              bg="#1D2E93"
              color="white"
              _hover={{ bg: 'blue.800' }}
            >
              Get Started →
            </Button>
          </HStack>
        </HStack>
      </Container>
    </Box>
  );
};

export default Navbar;