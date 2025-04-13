import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Heading, Text, Spinner, SimpleGrid, 
  Container, Flex, Avatar, Badge, Button,
  Stat, StatLabel, StatNumber, StatGroup,
  Divider, Tooltip
} from '@chakra-ui/react';
import { ArrowBackIcon, InfoIcon } from '@chakra-ui/icons';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

interface Contribution {
  name: string;
  party: string;
  state: string;
  contributor_name: string;
  amount: number;
  candidate_id?: string; // ID for looking up additional info
}

interface CandidateDetail {
  name: string;
  party: string;
  state: string;
  totalReceipts?: number;
  totalDisbursements?: number;
  cashOnHand?: number;
  individualContributions?: number;
  debtsOwed?: number;
  district?: string;
}

const IndustryDetail = () => {
  const { industry } = useParams<{ industry: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [candidateDetails, setCandidateDetails] = useState<Record<string, CandidateDetail>>({});

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
      transition: { duration: 0.4, ease: "easeOut" }
    }
  };

  // Fetch the industry contributions
  useEffect(() => {
    const fetchIndustryContributions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:3001/api/industry-contributions/${industry}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setContributions(data);
      } catch (err) {
        console.error('Error fetching industry contributions:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch industry contributions');
      } finally {
        setLoading(false);
      }
    };

    if (industry) {
      fetchIndustryContributions();
    }
  }, [industry]);

  // fetching candidate details from the databaseeeee
  useEffect(() => {
    const fetchCandidateDetails = async () => {
      const detailsMap: Record<string, CandidateDetail> = {};
      
      for (const contribution of contributions) {
        if (!contribution.candidate_id) continue;
        
        try {
          const response = await fetch(`http://localhost:3001/api/candidate-info/${contribution.candidate_id}`);
          
          if (!response.ok) {
            console.error(`Failed to get details for ${contribution.candidate_id}`);
            continue;
          }
          
          const data = await response.json();
          
          detailsMap[contribution.candidate_id] = {
            name: data.name || contribution.name,
            party: data.party || contribution.party,
            state: data.state || contribution.state,
            district: data.district,
            totalReceipts: data.totalReceipts,
            totalDisbursements: data.totalDisbursements,
            cashOnHand: data.cashOnHand,
            individualContributions: data.individualContributions,
            debtsOwed: data.debtsOwed
          };
        } catch (err) {
          console.error(`Error fetching details for ${contribution.candidate_id}:`, err);
        }
      }
      
      setCandidateDetails(detailsMap);
    };
    
    if (contributions.length > 0) {
      fetchCandidateDetails();
    }
  }, [contributions]);

  // Format currency for display
  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0 
    }).format(amount);
  };

  if (loading) {
    return (
      <Flex height="70vh" alignItems="center" justifyContent="center">
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex height="70vh" alignItems="center" justifyContent="center">
        <Text color="red.500">Error: {error}</Text>
      </Flex>
    );
  }

  return (
    <MotionBox
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <Box 
        backgroundImage={`/american-flag-bg.png`}
        backgroundSize="cover"
        backgroundPosition="center"
        borderRadius="40"
        mx={14}
        my={6}
        p={12}
        height="200px"
        position="relative"
      >
        <Heading 
          as="h1" 
          size="4xl" 
          color="white" 
          fontWeight="bold"
          letterSpacing="tighter"
        >
          {industry} Contributions
        </Heading>
      </Box>

      <Container maxW="container.xl" py={4}>
        <MotionFlex 
          mb={8} 
          align="center"
          variants={itemVariants}
        >
          <Button 
            leftIcon={<ArrowBackIcon />} 
            onClick={() => navigate('/explore')}
            colorScheme="blue"
            size="md"
          >
            Back to Industries
          </Button>
        </MotionFlex>
        
        <MotionBox variants={itemVariants}>
          <Heading size="lg" mb={4}>Top Recipients from {industry}</Heading>
          
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            {contributions.map((contribution, index) => {

              const details = contribution.candidate_id ? 
                candidateDetails[contribution.candidate_id] : undefined;
              
              return (
                <MotionBox 
                  key={`${contribution.name}-${index}`}
                  p={5}
                  shadow="md"
                  borderWidth="1px"
                  borderRadius="lg"
                  variants={itemVariants}
                  custom={index}
                  transition={{ delay: index * 0.05 }}
                  _hover={{ shadow: "lg" }}
                >
                  <Flex direction="column">
                    <Flex>
                      <Avatar size="md" name={details?.name || contribution.name} mr={4} />
                      <Box flex="1">
                        <Flex justify="space-between" align="baseline">
                          <Heading size="md">
                            {details?.name || contribution.name}
                          </Heading>
                          <Badge colorScheme={
                            (contribution.party === 'Republican' || contribution.party === 'REP') ? 'red' : 
                            (contribution.party === 'Democrat' || contribution.party === 'DEM') ? 'blue' : 
                            'green'
                          }>
                            {contribution.party}
                          </Badge>
                        </Flex>
                        <Text mt={1} color="gray.600">
                          {contribution.state} {details?.district && `District ${details.district}`}
                        </Text>
                        <Text mt={3} fontWeight="bold">
                          Received {formatCurrency(contribution.amount)}
                        </Text>
                        <Text fontSize="sm" mt={1}>
                          Top contributor: {contribution.contributor_name}
                        </Text>
                      </Box>
                    </Flex>
                    
                    
                  </Flex>
                </MotionBox>
              );
            })}
          </SimpleGrid>
        </MotionBox>
      </Container>
    </MotionBox>
  );
};

export default IndustryDetail; 