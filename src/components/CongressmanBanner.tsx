import {
  Box,
  Image,
  VStack,
  Heading,
  Text,
  Flex,
} from '@chakra-ui/react';

interface CongressmanBannerProps {
  name: string;
  party: string;
  state: string;
  image: string;
}

const CongressmanBanner = ({ name, party, state, image }: CongressmanBannerProps) => {
  return (
    <Box
      bg="white"
      p={6}
      borderRadius="xl"
      boxShadow="md"
      width="100%"
    >
      <Flex>
        <Image
          src={`http://localhost:3001/${image}`}
          alt={name}
          borderRadius="2xl"
          boxSize="100px"
          objectFit="cover"
          fallbackSrc="https://i.imgur.com/VlKTQWO.png"
        />
        <VStack align="flex-start" ml={8} spacing={2}>
          <Heading size="xl">{name}</Heading>
          <Text fontSize="lg" color="gray.600">
            {party} - {state}
          </Text>
        </VStack>
      </Flex>
    </Box>
  );
};

export default CongressmanBanner; 