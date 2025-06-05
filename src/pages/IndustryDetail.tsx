import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Heading, Text, Spinner, Container, Flex, Button,
  Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon,
  HStack, Badge, VStack, Link
} from '@chakra-ui/react';
import { ArrowBackIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);

interface Contribution {
  name: string;
  party: string;
  state: string;
  contributor_name: string;
  amount: number;
  candidate_id?: string;
  website?: string;
  size?: string;
  location?: string;
  type?: string;
}

interface IndustryGroup {
  industry: string;
  companies: Contribution[];
  totalContributions: number;
  connectionCount: number;
}

const IndustryDetail = () => {
  const { industry } = useParams<{ industry: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [industryGroups, setIndustryGroups] = useState<IndustryGroup[]>([]);

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

  // Format currency for display
  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0 
    }).format(amount);
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

        // Group contributions by industry
        const groupedData = data.reduce((acc: Record<string, IndustryGroup>, curr: Contribution) => {
          const industry = curr.contributor_name.split(' - ')[0] || 'Other';
          
          if (!acc[industry]) {
            acc[industry] = {
              industry,
              companies: [],
              totalContributions: 0,
              connectionCount: 0
            };
          }
          
          acc[industry].companies.push(curr);
          acc[industry].totalContributions += curr.amount;
          acc[industry].connectionCount += 1;
          
          return acc;
        }, {} as Record<string, IndustryGroup>);

        // Convert to array and sort by total contributions
        const sortedGroups = (Object.values(groupedData) as IndustryGroup[])
          .sort((a, b) => b.totalContributions - a.totalContributions)
          .slice(0, 5);

        setIndustryGroups(sortedGroups);
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
          {industry} Industry
        </Heading>
      </Box>

      <Container maxW="container.xl" py={4}>
        <MotionBox variants={itemVariants}>
          <Flex mb={8} align="center">
            <Button 
              leftIcon={<ArrowBackIcon />} 
              onClick={() => navigate('/explore')}
              colorScheme="blue"
              size="md"
            >
              Back to Industries
            </Button>
          </Flex>

          <Box
            bg="white"
            p={6}
            borderRadius="xl"
            boxShadow="md"
            width="100%"
            minHeight="400px"
          >
            <Heading size="lg" mb={4}>INDUSTRY CONNECTIONS</Heading>
            
            {loading ? (
              <Flex p={8} justify="center">
                <Spinner />
              </Flex>
            ) : error ? (
              <Text color="red.500">{error}</Text>
            ) : !industryGroups || industryGroups.length === 0 ? (
              <Flex direction="column" align="center" justify="center" p={8}>
                <Text color="gray.500" fontSize="lg" mb={2}>No industry connections found.</Text>
                <Text color="gray.400" fontSize="sm">This could be because the data is not yet in our database.</Text>
              </Flex>
            ) : (
              <Accordion allowMultiple>
                {industryGroups.map((group, index) => (
                  <AccordionItem key={index}>
                    <AccordionButton>
                      <Box flex="1" textAlign="left">
                        <HStack justify="space-between">
                          <Text fontWeight="medium">{group.industry}</Text>
                          <Badge colorScheme="blue">{group.connectionCount} companies</Badge>
                        </HStack>
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pb={4}>
                      <VStack align="stretch" spacing={3}>
                        {group.companies.slice(0, 3).map((company, companyIndex) => (
                          <Box key={companyIndex} p={3} bg="gray.50" borderRadius="md">
                            <VStack align="start" spacing={2}>
                              <HStack justify="space-between" w="100%">
                                <Text fontWeight="medium" fontSize="sm">{company.contributor_name}</Text>
                                <Badge colorScheme={company.party === 'Republican' ? 'red' : 'blue'}>
                                  {company.party}
                                </Badge>
                              </HStack>
                              
                              <HStack spacing={4} fontSize="xs" color="gray.600">
                                {company.size && <Text>Size: {company.size}</Text>}
                                {company.location && <Text>Location: {company.location}</Text>}
                              </HStack>
                              
                              <Text fontWeight="bold" color="green.600" fontSize="sm">
                                Contributions: {formatCurrency(company.amount)}
                              </Text>
                              
                              {company.website && (
                                <Link href={company.website} isExternal color="blue.500" fontSize="xs">
                                  Visit Website <ExternalLinkIcon mx="2px" />
                                </Link>
                              )}
                            </VStack>
                          </Box>
                        ))}
                      </VStack>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </Box>
        </MotionBox>
      </Container>
    </MotionBox>
  );
};

export default IndustryDetail; 