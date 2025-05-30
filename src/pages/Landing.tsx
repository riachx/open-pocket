// src/pages/Landing.tsx
import { 
  Box, Container, Heading, Text, Button, VStack, Image, Flex, Grid, GridItem,
  Menu, MenuButton, MenuList, MenuItem, Icon
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { Link, useNavigate } from 'react-router-dom';

const Landing = () => {
  const navigate = useNavigate();
  
  // Industry list matching what's available on Explore page
  const industries = [
    "Pharmaceuticals",
    "Military & Defense",
    "Insurance",
    "Oil & Gas", 
    "Electronics & Tech"
  ];

  const handleIndustrySelect = (industry: string) => {
    navigate(`/industry/${encodeURIComponent(industry)}`);
  };

  return (
    <Box>
      {/* First Section - Hero Banner */}
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
              fontSize="90px"
              fontWeight="bold"
              letterSpacing="tight"
            >
              OpenPockets
            </Heading>
            
            <Text
              fontSize="2xl"
              maxW="600px"
              lineHeight="1.4"
            >
              Because the financial interests of our leaders shouldn't be a secret.
            </Text>

            <Flex gap={4} mt={4}>
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
              >
                Explore →
              </Button>
              
              
            </Flex>

            
            

      <Menu placement="bottom" strategy="fixed" autoSelect={false}>
                <MenuButton
                  position="absolute"
                  bottom="20px"
                  left="50%"
                  transform="translateX(-50%)"
                  as={Button}
                  rightIcon={<ChevronDownIcon />}
                  bg="rgba(255, 255, 255, 1)"
                  color="gray.800"
                  size="lg"
                  _hover={{ bg: 'white' }}
                  _active={{ bg: 'white' }}
                  boxShadow={"lg"}
                  width="500px"
                  height="60px"
                  zIndex={2}
                >
                  Explore by Category
                </MenuButton>
                <MenuList 
                  mt="2px" 
                  zIndex={3}
                  minWidth="500px"
                >
                  {industries.map((industry, index) => (
                    <MenuItem 
                      key={index}
                      onClick={() => handleIndustrySelect(industry)}
                      color="#1D2E93"
                      _hover={{
                        bg: 'gray.100',
                        color: '#b5305f'
                      }}
                      fontWeight="medium"
                    >
                      {industry}
                    </MenuItem>
                  ))}
                </MenuList>
              </Menu>

          </VStack>
          

          
        </Container>

        
      </Box>


      {/* Second Section - Capitol Image with Mission */}
      <Container maxW="container.xl" py={20}>
        <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={10}>
          <GridItem>
            <Box 
              borderRadius="40"
              overflow="hidden"
              boxShadow="lg"
              h="100%"
            >
              <Image
                src="/washington.png"
                alt="Capitol Building at Night"
                w="100%"
                h="100%"
                objectFit="cover"
              />
            </Box>
          </GridItem>
          <GridItem display="flex" alignItems="center">
            <VStack align="flex-start" spacing={6} px={4}>
              <Heading 
                bgGradient="linear(to-r, #b5305f, #731cb8)"
                bgClip="text"
                color="transparent"
                size="2xl"
                lineHeight="1.2"
                letterSpacing="tighter"
              >
                Track and explore the interests of politicians.
              </Heading>
              
              <Text fontSize="xl" color="gray.800" letterSpacing={"tight"}>
              We shine a light on where the money flows—whether it's campaign donations, Super PAC expenditures, or lobbying efforts—so you can understand who really holds the power behind the policies.
              </Text>
              
              <Text fontSize="xl" color="gray.800" letterSpacing={"tight"}>
              OpenPockets allows you to see who's really backing your ballot.
              </Text>
            </VStack>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default Landing;