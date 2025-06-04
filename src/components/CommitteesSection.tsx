import {
  Box,
  Heading,
  Text,
  VStack,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Center,
  Spinner,
  Flex,
} from '@chakra-ui/react';

interface CommitteeContribution {
  name: string;
  entity_type: string;
  total_amount: number;
  transaction_count: number;
}

interface CommitteesSectionProps {
  committees: CommitteeContribution[];
  isLoading: boolean;
  error: string | null;
}

const CommitteesSection = ({ committees, isLoading, error }: CommitteesSectionProps) => {
  // Calculate total contributions
  const totalContributions = committees.reduce((sum, committee) => sum + committee.total_amount, 0);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Box
      bg="white"
      p={6}
      borderRadius="xl"
      boxShadow="md"
      width="100%"
      minHeight="400px"
    >
      <Heading size="lg" mb={4}>AFFILIATED COMMITTEES</Heading>
      
      {/* Summary Stats */}
      <StatGroup mb={6}>
        <Stat>
          <StatLabel>Total Committee Contributions</StatLabel>
          <StatNumber>{formatCurrency(totalContributions)}</StatNumber>
        </Stat>
        <Stat>
          <StatLabel>Total Committees</StatLabel>
          <StatNumber>{committees.length}</StatNumber>
        </Stat>
      </StatGroup>
      
      {isLoading ? (
        <Center p={8}>
          <Spinner />
        </Center>
      ) : error ? (
        <Text color="red.500">{error}</Text>
      ) : committees.length === 0 ? (
        <Flex direction="column" align="center" justify="center" p={8}>
          <Text color="gray.500" fontSize="lg" mb={2}>No committee contributions found for this politician.</Text>
          <Text color="gray.400" fontSize="sm">This could be because the politician is new or their data is not yet in our database.</Text>
        </Flex>
      ) : (
        <Box overflowX="auto">
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Committee Name</Th>
                <Th>Type</Th>
                <Th isNumeric>Amount</Th>
                <Th isNumeric>Transactions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {committees.map((committee, index) => (
                <Tr key={index}>
                  <Td fontWeight="medium">{committee.name}</Td>
                  <Td>
                    <Badge colorScheme="purple">{committee.entity_type}</Badge>
                  </Td>
                  <Td isNumeric fontWeight="bold">{formatCurrency(committee.total_amount)}</Td>
                  <Td isNumeric>{committee.transaction_count}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
};

export default CommitteesSection; 