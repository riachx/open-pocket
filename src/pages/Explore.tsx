// src/pages/Explore.tsx
import { 
  Container, 
  Heading, 
  Box,
  SimpleGrid, 
  Text,
  Flex,
  Image,
  HStack
} from '@chakra-ui/react';
import { ArrowForwardIcon } from '@chakra-ui/icons';
import { motion } from 'framer-motion';

// Create motion components
const MotionBox = motion(Box);
const MotionFlex = motion(Flex);
const MotionSimpleGrid = motion(SimpleGrid);

const Explore = () => {
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  const industries = [
    { name: "Pharmaceuticals", image: "/pills.png" },
    { name: "Military & Defense", image: "/military.png" },
    { name: "Insurance", image: "/money.png" },
    { name: "Oil & Gas", image: "/oil.png" },
    { name: "Electronics & Tech", image: "/speech.png" }
  ];

  return (
    <MotionBox
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Hero Banner */}
      <MotionBox 
        backgroundImage="/american-flag-bg.png"
        backgroundSize="cover"
        backgroundPosition="center"
        borderRadius="40"
        mx={12}
        my={6}
        p={12}
        height="200px"
        position="relative"
        variants={itemVariants}
      >
        
        <Heading 
          as="h1" 
          size="4xl" 
          color="white" 
          fontWeight="bold"
          letterSpacing="tighter"
        >
          Explore Spending
        </Heading>
      </MotionBox>

      {/* Industry Spending Section */}
      <MotionBox 
        mx={14}
        my={6}
        variants={itemVariants}
      >
        <Heading size="xl" mb={2}>Industry Spending</Heading>
        <Text mb={8}>View industry-based spending.</Text>
        
        <MotionSimpleGrid 
          columns={{ base: 1, md: 2, lg: 5 }} 
          spacing={6}
          variants={containerVariants}
        >
          {industries.map((industry, index) => (
            <MotionBox
              key={index}
              borderRadius="xl"
              overflow="hidden"
              position="relative"
              height="300px"
              variants={itemVariants}
              transition={{ delay: index * 0.05 }}
              display="flex"
              flexDirection="column"
              justifyContent="space-between"
            >
              <Box
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                zIndex={0}
              >
                <Image 
                  src={industry.image}
                  alt={industry.name}
                  objectFit="cover"
                  w="100%"
                  h="100%"
                />
              </Box>
              <Text 
                fontSize="xl" 
                fontWeight="bold" 
                p={4}
                color="white"
                zIndex={1}
                position="relative"
              >
                {industry.name}
              </Text>
              <Flex 
                justifyContent="space-between"
                alignItems="center"
                bg="white"
                borderRadius="xl"
                p={2}
                pl={4}
                pr={4}
                m={4}
                zIndex={1}
              >
                <Text fontWeight="bold">EXPLORE</Text>
                <ArrowForwardIcon />
              </Flex>
            </MotionBox>
          ))}
        </MotionSimpleGrid>
      </MotionBox>
    </MotionBox>
  );
};

export default Explore;