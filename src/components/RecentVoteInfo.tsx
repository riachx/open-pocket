import {
    Box,
    Heading,
    Text,
    VStack,
    Badge,
    Flex,
    Divider,
    useColorModeValue,
    Spinner,
    Center,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    useDisclosure,
    Tooltip,
    Skeleton,
    SkeletonText,
} from '@chakra-ui/react';
import { useState } from 'react';

interface VoteInfo {
    votes: Array<{
        congress: number;
        session: number;
        voteNumber: number;
        legislation: string;
        result: string;
        date: string;
        question: string;
        voteCast?: string;
        billInfo?: {
            title?: string;
            shortTitle?: string;
            latestAction?: string;
            policyArea?: string;
            legislativeSubjects?: string[];
        };
    }>;
}

interface RecentVoteInfoProps {
    voteInfo: VoteInfo | null;
    congressmanId: string;
    isLoading?: boolean;
}

const RecentVoteInfo = ({ voteInfo, congressmanId, isLoading = false }: RecentVoteInfoProps) => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [selectedTitle, setSelectedTitle] = useState('');

    const calmColors = [
        'blue',
        'red',
        'green',
        'orange'
    ];

    const getRandomColor = (index: number) => {
        return calmColors[index % calmColors.length];
    };

    const handleBillClick = (title: string, subjects: string[]) => {
        setSelectedTitle(title);
        setSelectedSubjects(subjects);
        onOpen();
    };

    const isLongTitle = selectedTitle.length > 30;

    if (isLoading) {
        return (
            <Box
                bg={useColorModeValue('white', 'gray.800')}
                p={6}
                borderRadius="xl"
                boxShadow="md"
                width="100%"
                border="1px"
                borderColor={useColorModeValue('gray.200', 'gray.700')}
            >
                <Skeleton height="24px" width="150px" mb={2} />
                <Divider mb={4} />
                <VStack align="stretch" spacing={4}>
                    {[1, 2, 3].map((_, index) => (
                        <Box key={index} p={4}>
                            <Flex align="center" gap={4}>
                                <Skeleton height="24px" width="80px" />
                                <Box flex="1">
                                    <Skeleton height="20px" width="80%" mb={2} />
                                    <Skeleton height="16px" width="120px" />
                                </Box>
                            </Flex>
                            <Box mt={2}>
                                <SkeletonText noOfLines={2} spacing={2} />
                            </Box>
                            <Box mt={1}>
                                <Skeleton height="16px" width="100px" />
                            </Box>
                            {index < 2 && <Divider mt={4} />}
                        </Box>
                    ))}
                </VStack>
            </Box>
        );
    }

    if (!voteInfo?.votes?.length) return null;

    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    const getVoteColor = (vote: string | undefined) => {
        if (!vote) return 'gray';
        switch (vote.toLowerCase()) {
            case 'yea':
                return 'green';
            case 'aye':
                return 'green';
            case 'nay':
                return 'red';
            case 'no':
                return 'red';
            case 'not voting':
                return 'gray';
            default:
                return 'blue';
        }
    };

    const formatVoteDisplay = (vote: string | undefined) => {

        if (!vote) {

            return 'N/A';
        }
        const lowerVote = vote.toLowerCase();

        switch (lowerVote) {
            case 'yea':
                return 'YES';
            case 'aye':
                return 'YES';
            case 'nay':
                return 'NO';
            case 'not voting':
                return 'NOT VOTING';
            default:

                return vote;
        }
    };

    return (
        <Box
            bg={bgColor}
            p={6}
            borderRadius="xl"
            boxShadow="md"
            width="100%"
            border="1px"
            borderColor={borderColor}
        >
            <Heading size="md" mb={2}>Recent Votes</Heading>
            <Divider mb={4} />

            <VStack align="stretch" spacing={4}>
                {voteInfo.votes.slice(0, 5).map((vote, index) => (
                    <Box 
                        key={`${vote.congress}-${vote.voteNumber}`}
                        p={4}
                        borderRadius="md"
                        transition="all 0.2s"
                        cursor="pointer"
                        onClick={() => handleBillClick(vote.legislation, vote.billInfo?.legislativeSubjects || [])}
                        _hover={{
                            bg: useColorModeValue('gray.50', 'gray.700'),
                            transform: 'translateY(-2px)',
                            boxShadow: 'md'
                        }}
                    >
                        <Flex align="center" gap={4}>
                            <Badge
                                colorScheme={getVoteColor(vote.voteCast)}
                                fontSize="md"
                                px={3}
                                py={1}
                                fontWeight="bold"
                            >
                                {formatVoteDisplay(vote.voteCast)}
                            </Badge>
                            <Box flex="1">
                                <Text 
                                    fontSize="lg" 
                                    fontWeight="medium" 
                                    color="gray.700"
                                >
                                    {vote.legislation}
                                    {vote.billInfo?.policyArea && (
                                        <Badge ml={2} colorScheme="blue" fontSize="sm">
                                            {vote.billInfo.policyArea}
                                        </Badge>
                                    )}
                                </Text>
                                <Text fontSize="sm" color="gray.500" mt={1}>
                                    {new Date(vote.date).toLocaleDateString()}
                                </Text>
                            </Box>
                        </Flex>

                        <Box mt={2}>
                            <Text fontSize="sm" color="gray.600">
                                {vote.question}
                            </Text>
                        </Box>

                        <Box mt={1}>
                            <Text fontSize="sm" color="gray.500">
                                Result: <Badge colorScheme={vote.result === 'Passed' ? 'green' : 'red'}>
                                    {vote.result}
                                </Badge>
                            </Text>
                        </Box>

                        {index < Math.min(4, voteInfo.votes.length - 1) && <Divider mt={4} />}
                    </Box>
                ))}
            </VStack>

            <Modal 
                isOpen={isOpen} 
                onClose={onClose}
                isCentered
                motionPreset="slideInBottom"
                size={isLongTitle ? "xl" : "md"}
            >
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader 
                        pb={2}
                        borderBottom="1px"
                        borderColor={useColorModeValue('gray.200', 'gray.700')}
                    >
                        <Text 
                            fontSize={isLongTitle ? "lg" : "2xl"}
                            fontWeight="bold"
                            color={useColorModeValue('gray.700', 'white')}
                            lineHeight="1.2"
                        >
                            {selectedTitle}
                        </Text>
                    </ModalHeader>
                    <ModalCloseButton 
                        size="lg"
                        mt={2}
                        mr={2}
                    />
                    <Divider />
                    <ModalBody pb={6}>
                        <Flex direction="column" gap={4}>
                            <Flex justify="space-between" align="center">
                                <Text fontWeight="bold">Legislative Subjects:</Text>
                                <Badge colorScheme="blue" variant="subtle">
                                    {selectedSubjects.length} subjects
                                </Badge>
                            </Flex>
                            <Box 
                                bg={useColorModeValue('gray.50', 'gray.700')} 
                                p={4} 
                                borderRadius="lg"
                            >
                                <Flex gap={3} flexWrap="wrap">
                                    {selectedSubjects.map((subject, idx) => (
                                        <Tooltip 
                                            key={idx}
                                            label={subject}
                                            placement="top"
                                            hasArrow
                                        >
                                            <Badge 
                                                fontSize="md" 
                                                px={3} 
                                                py={1}
                                                maxW="500px"
                                                position="relative"
                                                borderRadius="full"
                                                colorScheme={getRandomColor(idx)}
                                                variant="subtle"
                                                transition="all 0.2s"
                                                _hover={{
                                                    transform: 'translateY(-2px)',
                                                    boxShadow: 'sm',
                                                    opacity: 0.9
                                                }}
                                            >
                                                <Text 
                                                    isTruncated
                                                    maxW="350px"
                                                >
                                                    {subject}
                                                </Text>
                                            </Badge>
                                        </Tooltip>
                                    ))}
                                </Flex>
                            </Box>
                        </Flex>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </Box>
    );
};

export default RecentVoteInfo; 