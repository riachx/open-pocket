import { 
  Box, Container, Heading, Text, Grid, GridItem, VStack, Flex, Link,
  Image
} from '@chakra-ui/react';
import { ArrowForwardIcon } from '@chakra-ui/icons';
import { motion } from 'framer-motion';

// Create motion components
const MotionBox = motion(Box);
const MotionGrid = motion(Grid);
const MotionGridItem = motion(GridItem);
const MotionFlex = motion(Flex);
const MotionContainer = motion(Container);

const About = () => {
  // Animation variants
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
      py={8}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Top Section - Flag and Washington */}
      <MotionGrid 
        templateColumns={{ base: "1fr", md: "1fr 1fr" }}
        gap={4}
        mb={4}
        variants={itemVariants}
      >
        {/* Left Section - Large Flag */}
        <MotionGridItem variants={itemVariants}>
          <Box
            borderRadius="2xl"
            overflow="hidden"
            height="500px"
          >
            <Image
              src="/man.png"
              alt="Person holding American flag"
              objectFit="cover"
              w="100%"
              h="100%"
            />
          </Box>
        </MotionGridItem>

        {/* Right Section - Who Owns Your Politician */}
        <MotionGridItem display="flex" flexDirection="column" gap={4} variants={itemVariants}>
          <MotionBox position="relative" height="250px" variants={itemVariants}>
            <Image
              src="/blue-washington.png"
              alt="washington-dc"
              objectFit="cover"
              w="100%"
              borderRadius="xl"
              height="100%"
            />
            <Box
              position="absolute"
              top="0"
              left="0"
              right="0"
              bottom="0"
              p={6}
              borderRadius="xl"
              display="flex"
              flexDirection="column"
              justifyContent="space-between"
            >
              <Heading size="xl" letterSpacing="tight" fontSize="45" color="white">
                WHO OWNS YOUR POLITICIAN <ArrowForwardIcon />
              </Heading>
              <Text fontSize="md" color="white" fontWeight="light">
                TRACK DONATIONS, LOBBYING EFFORTS, AND POLITICAL SPENDING.
              </Text>
            </Box>
          </MotionBox>

          {/* Small Flags Side by Side */}
          <MotionFlex direction="row" gap={4} variants={itemVariants}>
            <Box
              borderRadius="xl"
              overflow="hidden"
              height="230px"
              flex="1"
            >
              <Image
                src="/yell.png"
                alt="American flag"
                objectFit="cover"
                w="100%"
                h="100%"
              />
            </Box>
            <Box
              borderRadius="xl"
              overflow="hidden"
              height="230px"
              flex="1"
            >
              <Image
                src="/money.png"
                alt="American flag"
                objectFit="cover"
                w="100%"
                h="100%"
              />
            </Box>
          </MotionFlex>
        </MotionGridItem>
      </MotionGrid>
  
      <MotionBox
        position="relative"
        borderRadius="xl"
        overflow="hidden"
        width="100%"
        mb={4}
        display="flex"
        justifyContent="center"
        variants={itemVariants}
      >
        <Image
          src="/citizens.png"
          alt="citizens-united text"
          objectFit="contain"
          maxW="100%"
        />
      </MotionBox>
  
      {/* OpenPockets Mission Statement */}
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
      </MotionBox>
    </MotionContainer>
  );
};

export default About;
