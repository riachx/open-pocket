import { 
  Box, Container, Heading, Text, Grid, GridItem, VStack, Flex, Link,
  Image, useColorModeValue, Divider
} from '@chakra-ui/react';
import { ArrowForwardIcon, ArrowLeftIcon, ArrowRightIcon } from '@chakra-ui/icons';
import { motion } from 'framer-motion';
import { useRef } from 'react';
import { StarIcon } from '@chakra-ui/icons';

// MOTION STUFF
const MotionBox = motion(Box);
const MotionGrid = motion(Grid);
const MotionGridItem = motion(GridItem);
const MotionFlex = motion(Flex);
const MotionContainer = motion(Container);

const About = () => {
  const citizensUnitedRef = useRef<HTMLDivElement>(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.900', 'white');
  const textLetterSpacing = -1;
  const secondaryBg = useColorModeValue('gray.50', 'gray.700');

  // animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.2
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

  return (
    <MotionContainer
      maxW="container.xl" 
      py={12}
      px={{ base: 4, md: 8 }}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Top Section - Main Layout */}
      <MotionGrid 
        templateColumns={{ base: "1fr", md: "1.5fr 1fr" }}
        gap={4}
        mb={8}
        variants={itemVariants}
      >
        {/* Left Section - Heading and Image */}
        <MotionGridItem variants={itemVariants} w="100%">
          <VStack spacing={12} align="start" w="100%">
            <Heading 
              size="2xl" 
              fontSize={{ base: "4xl", md: "80" }}
              fontWeight="500"
              letterSpacing="tighter"
              color={textColor}
              w="100%"
              pr={{ base: 0, md: 8 }}
            >
              Who Really <Text as="span" fontWeight="300">Owns</Text> Your <Text as="span" color="gray.800" fontWeight="300">Politician?</Text>
            </Heading>
            <Box
              
              borderRadius="25"
              overflow="hidden"
              height="350px"
              width="100%"
            >
              <Image
                src="/man.png"
                alt="Person holding American flag"
                objectFit="cover"
                w="100%"
                h="100%"
              />
            </Box>
          </VStack>
        </MotionGridItem>

        {/* Right Section - Testimonial and Content */}
        <MotionGridItem variants={itemVariants}>
          <VStack spacing={4} align="start" position= "relative" top={4} ml={{ base: 0, md: 2}}>
            {/* Testimonial Button */}
            <Flex
              alignItems="center"
              bg="gray.100"
              p={2}
              borderRadius="full"
              w="fit-content"
            >
              <Box
                w="24px"
                h="24px"
                borderRadius="4xl"
                overflow="hidden"
                mr={2}
              >
                <Image
                  src="/man.png"
                  alt="User avatar"
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  borderRadius="full"
                  
                />
              </Box>
              <Text fontSize="xs" fontWeight="medium">TOP TESTIMONIAL</Text>
            </Flex>

            {/* Testimonial Text */}
            <Text fontSize="md" letterSpacing={-0.5} color="gray.500" lineHeight="1.6">
              "OpenPockets helped me understand who's exactly funding my representatives. Now I can make more informed decisions about voting..."
            </Text>

            {/* Rating */}
            <Flex alignItems="center" gap={2}>
              <Box color="yellow.400">
                <StarIcon w={5} h={5} />
              </Box>
              <Text fontWeight="medium">4.8</Text>
            </Flex>

            {/* Horizontal Image */}
            <Box
              borderRadius="xl"
              overflow="hidden"
              height="200px"
              width="100%"
            >
              <Image
                src="/blue-washington.png"
                alt="Washington monument"
                objectFit="cover"
                w="100%"
                h="100%"
                borderRadius="25"
              />
            </Box>

            {/* Content Below Image */}
            <VStack align="start" spacing={2}>
              <Heading fontSize="22" fontWeight="600" letterSpacing={-1}>
                Track Political Influence
              </Heading>
              <Text fontSize="sm" color="gray.600" maxW="400px">
                Discover how money flows through politics and who's influencing your representatives. Follow the money trail from lobbyists to legislation.
              </Text>
              <Link 
                fontSize="sm" 
                color="gray.600" 
                textDecoration="underline" 
                _hover={{ color: "gray.800" }}
                transition="all 0.2s"
              >
                SEE DETAIL →
              </Link>
            </VStack>
          </VStack>
        </MotionGridItem>
      </MotionGrid>
  

        


      {/* Divider */}
      <Divider my={16} />

      {/* New Section: Putting Transparency into Action */}
      <MotionBox
        py={12}
        px={8}
        bg={bgColor}
        borderRadius="xl"
        mb={12}
        variants={itemVariants}
        textAlign="center"
      >

      {/* Learn More Hover Box */}
        <Box
          display="inline-block"
          px={4}
          py={2}
          mb={2}
          borderRadius="full"
          bg="white"
          color={textColor}
          fontWeight="medium"
          fontSize="sm"
          boxShadow="0px 0px 10px 0px rgba(0, 0, 0, 0.1)"
          stroke="5"
          letterSpacing="tight"
          cursor="pointer"
          transition="all 0.2s ease-in-out"
          _hover={{
            bg: textColor,
            color: bgColor,
            boxShadow: "md"
          }}
          onClick={() => {
            citizensUnitedRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <Text>
            Learn More
          </Text>
        </Box>

        <Heading maxW={"70%"} my="4" pb ="8" mx="auto" fontSize={32} lineHeight={"140%"} fontWeight={400} mb={6} color="gray.800" letterSpacing="tighter">
        Since Citizens v. United opened the floodgates to unlimited political spending, OpenPockets has been tracking the dark money flowing through our democracy. We shine a light on who's buying influence and help you hold politicians accountable.
        </Heading>


        <MotionFlex 
          direction={{ base: "column", md: "row" }}
          gap={3}
          variants={containerVariants}
          justifyContent="center"
          alignItems="center"
        >
          <MotionBox variants={itemVariants} p={0} m={0} flexShrink={0}>
            <Box
              transition="all 0.3s ease-in-out"
              _hover={{
                transform: 'scale(1.03)',
                
              }}
            >
              <Box
                overflow="hidden"
                height="200px"
                mb={4}
                display="flex"
                justifyContent="center"
                alignItems="center"
              >
                {/* Placeholder Image 1 */}
                <Image
                  src="/yell.png"
                  alt="Track Campaign Finance"
                  objectFit="cover"
                  w="200px"
                  h="100%"
                  borderRadius="35px"
                />
              </Box>
              <Text fontSize="md" color={textColor} fontWeight="medium" letterSpacing = {textLetterSpacing}>
                Track Campaign Finance
              </Text>
            </Box>
          </MotionBox>

          <MotionBox variants={itemVariants} p={0} m={0} flexShrink={0}>
            <Box
              transition="all 0.3s ease-in-out"
              _hover={{
                transform: 'scale(1.03)',
                
              }}
            >
              <Box
                overflow="hidden"
                height="200px"
                mb={4}
                display="flex"
                justifyContent="center"
                alignItems="center"
              >
                {/* Placeholder Image 2 */}
                <Image
                    src="/oil.png"
                    alt="Analyze Political Influence"
                    objectFit="cover"
                    w="200px"
                    h="100%"
                    borderRadius="35px"
                />
              </Box>
              <Text fontSize="md" color={textColor} fontWeight="medium" letterSpacing = {textLetterSpacing}>
                Analyze Political Influence
              </Text>
            </Box>
          </MotionBox>

          <MotionBox variants={itemVariants} p={0} m={0} flexShrink={0}>
            <Box
              transition="all 0.3s ease-in-out"
              _hover={{
                transform: 'scale(1.03)',
                
              }}
            >
              <Box
                overflow="hidden"
                height="200px"
                mb={4}
                display="flex"
                justifyContent="center"
                alignItems="center"
              >
                {/* Placeholder Image 3 */}
                <Image
                    src="/money.png"
                    alt="Stay Informed"
                    objectFit="cover"
                    w="200px"
                    h="100%"
                    borderRadius="35px"
                />
              </Box>
              <Text fontSize="md" color={textColor} fontWeight="medium" letterSpacing = {textLetterSpacing}>
                Stay Informed & Engaged
              </Text>
            </Box>
          </MotionBox>

          
        </MotionFlex>
        
      </MotionBox>


{/* Divider */}
<Divider my={16} />
      {/* New Section: Stats and Work Description */}
      <Container maxW="container.xl" py={16}>
        {/* Top part: Heading, Description, Button */}
        <Flex
          direction={{ base: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ base: "flex-start", md: "center" }}
          mb={12}
          gap={{ base: 8, md: 0 }}
        >
          <Box maxW={{ base: "100%", md: "50%" }}>
            <Heading 
              size="2xl" 
              fontWeight="500"
              letterSpacing="tighter"
              color={textColor}
              mb={4}
            >
              Work With OpenPockets For Free Today
            </Heading>
          </Box>
          <VStack align={{ base: "flex-start", md: "flex-end" }} spacing={6} maxW={{ base: "100%", md: "40%" }}>
            <Text fontSize="md" color="gray.600" textAlign={{ base: "left", md: "right" }}>
            Political transparency has become increasingly challenging as government funding for data access has been reduced. We simplify the process of staying informed.
            </Text>
            <Link
              href="#"
              px={8}
              py={3}
              bg="black"
              color="white"
              borderRadius="full"
              fontWeight="medium"
              _hover={{ opacity: 0.9 }}
              transition="opacity 0.2s"
            >
              See More
            </Link>
          </VStack>
        </Flex>

        {/* Bottom part: Stat Cards */}
        <Grid 
          templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
          gap={6}
        >
          <GridItem>
            <Box p={6} bg={secondaryBg} borderRadius="xl">
              <Heading size="xl" mb={2}>1000+</Heading>
              <Text fontSize="sm" color="gray.600">
                Records Tracked Daily
              </Text>
            </Box>
          </GridItem>
          <GridItem>
            <Box p={6} bg={secondaryBg} borderRadius="xl">
              <Heading size="xl" mb={2}>5000+</Heading>
              <Text fontSize="sm" color="gray.600">
                Politicians Monitored
              </Text>
            </Box>
          </GridItem>
          <GridItem>
            <Box p={6} bg={secondaryBg} borderRadius="xl">
              <Heading size="xl" mb={2}>15 GB+</Heading>
              <Text fontSize="sm" color="gray.600">
                Data Processed
              </Text>
            </Box>
          </GridItem>
        </Grid>
      </Container>

      
{/* Divider */}
<Divider my={16} />

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
                Our Inspiration:
              </Heading>
              
              <Text fontSize="xl" color="gray.800" letterSpacing={"tight"}>
              In 2010, the U.S. Supreme Court ruled in Citizens United v. Federal Election Commission that corporations, unions, and other 
              organizations can spend unlimited money on political campaigns—as long as they do so independently. 



              </Text>
              
              <Text fontSize="xl" color="gray.800" letterSpacing={"tight"}>
              This allows powerful entities to quietly shape legislation, sway public policy, and prioritize corporate interests over citizens, all while avoiding accountability and public scrutiny.
              </Text>

              <Text fontSize="xl" color="gray.800" letterSpacing={"tight"}>
              The Court argued that political spending is a form of free speech protected by the First Amendment 
              </Text>
              
            </VStack>
          </GridItem>
        </Grid>
      </Container>


     
  
      {/* OpenPockets Mission Statement 
      <MotionBox
        position="relative"
        borderRadius="xl"
        overflow="hidden"
        height="300px"
        mb={4}
        variants={itemVariants}
      >
        <Image
          src="/columns.png"
          alt="columns background"
          objectFit="cover"
          w="100%"
          h="100%"
        />
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          p={8}
          display="flex"
          flexDirection="column"
          justifyContent="center"
        >
          <Heading color="white" size="2xl" mb={4} textAlign="center" letterSpacing="tighter">
            OpenPockets <Text as="span" fontWeight="normal">exists because of this.</Text>
          </Heading>
          <Text color="white" fontSize="lg" maxW="800px" mx="auto" textAlign="center">
            When money can shape policy behind closed doors, voters deserve a way to see who's paying, who's influencing,
            and who's benefiting. Our platform tracks these financial trails to bring transparency back to democracy.
          </Text>
        </Box>
      </MotionBox>*/}

    </MotionContainer>
  );
};

export default About;
