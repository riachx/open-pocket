// src/components/Footer.tsx
import { Box, Container, Stack, Text, Link } from '@chakra-ui/react';

const Footer = () => {
  return (
    <Box
      as="footer"
      backgroundColor="#F1F1F1"
      //bgGradient="linear(to-r, #BE2C47 0%, #BE2C47 0%, #1D2E93 24%, #0D1753 80%, #0D1753 100%)"
      //color="#E8E8E8"
      py={8}
      mt="auto"
    >
      <Container maxW="container.xl">
        <Stack
          direction={{ base: 'column', md: 'row' }}
          justify="space-between"
          align="center"
        >
          <Text>© 2024 Political Finance Tracker. All rights reserved.</Text>
          
          <Stack direction="row" spacing={6}>
            <Link _hover={{ color: 'gray.200' }}>About</Link>
            <Link _hover={{ color: 'gray.200' }}>Privacy</Link>
            <Link _hover={{ color: 'gray.200' }}>Terms</Link>
            <Link _hover={{ color: 'gray.200' }}>Contact</Link>
          </Stack>

          <Stack direction="row">
            {/* Add social media icons here if needed */}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

export default Footer;