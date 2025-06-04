import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
} from '@chakra-ui/react';

interface ApiTestStatus {
  loading: boolean;
  success: boolean | null;
  message: string;
  data: any;
}

interface ApiTestSectionProps {
  testStatus: ApiTestStatus;
  onTest: () => void;
}

const ApiTestSection = ({ testStatus, onTest }: ApiTestSectionProps) => {
  return (
    <Box
      bg="white"
      p={6}
      borderRadius="xl"
      boxShadow="md"
      width="100%"
    >
      <Heading size="md" mb={4}>API Test Section</Heading>
      <VStack align="stretch" spacing={4}>
        <Button
          colorScheme="blue"
          onClick={onTest}
          isLoading={testStatus.loading}
          loadingText="Testing..."
        >
          Test Congress API
        </Button>
        
        {testStatus.message && (
          <Box
            p={4}
            borderRadius="md"
            bg={testStatus.success === null 
              ? 'gray.100' 
              : testStatus.success 
                ? 'green.100' 
                : 'red.100'
            }
          >
            <Text
              color={testStatus.success === null 
                ? 'gray.700' 
                : testStatus.success 
                  ? 'green.700' 
                  : 'red.700'
              }
            >
              {testStatus.message}
            </Text>
          </Box>
        )}

        {testStatus.data && (
          <Box
            p={4}
            borderRadius="md"
            bg="gray.50"
            maxH="200px"
            overflowY="auto"
          >
            <Text fontSize="sm" fontFamily="monospace">
              {JSON.stringify(testStatus.data, null, 2)}
            </Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default ApiTestSection; 