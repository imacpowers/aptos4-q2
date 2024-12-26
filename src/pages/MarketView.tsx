import React, { useState, useEffect } from "react";
import { Typography, Radio, message, Card, Row, Col, Pagination, Tag, Button, Modal, Input } from "antd";
import { AptosClient } from "aptos";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { debounce, deburr } from 'lodash';
import { Translatable } from '../components/translation/Translatable';

const { Title } = Typography;
const { Meta } = Card;
const { Search } = Input;

const client = new AptosClient("https://fullnode.testnet.aptoslabs.com/v1");

type NFT = {
  id: number;
  owner: string;
  name: string;
  description: string;
  uri: string;
  price: number;
  for_sale: boolean;
  rarity: number;
  is_auction: boolean;
  auction_end: number | null;
  highest_bid: number | null;
  highest_bidder: string | null;
};

interface MarketViewProps {
  marketplaceAddr: string;
}

const rarityColors: { [key: number]: string } = {
  1: "green",
  2: "blue", 
  3: "purple",
  4: "orange",
};

const rarityLabels: { [key: number]: string } = {
  1: "Common",
  2: "Uncommon",
  3: "Rare", 
  4: "Super Rare",
};

const truncateAddress = (address: string, start = 6, end = 4) => {
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

const calculateSearchScore = (searchTerm: string, nft: NFT): number => {
  const normalizedSearch = deburr(searchTerm.toLowerCase());
  const normalizedName = deburr(nft.name.toLowerCase());
  const normalizedDesc = deburr(nft.description.toLowerCase());
  
  let score = 0;
  
  // Exact matches in name are weighted highest
  if (normalizedName.includes(normalizedSearch)) {
    score += 3;
  }
  
  // Word-by-word matches in name
  const searchWords = normalizedSearch.split(/\s+/);
  const nameWords = normalizedName.split(/\s+/);
  const descWords = normalizedDesc.split(/\s+/);
  
  searchWords.forEach(word => {
    // Name word matches
    nameWords.forEach(nameWord => {
      if (nameWord.includes(word)) score += 2;
      if (word.includes(nameWord)) score += 1;
    });
    
    // Description word matches
    descWords.forEach(descWord => {
      if (descWord.includes(word)) score += 1;
      if (word.includes(descWord)) score += 0.5;
    });
  });
  
  return score;
};

const MarketView: React.FC<MarketViewProps> = ({ marketplaceAddr }) => {
  const { signAndSubmitTransaction } = useWallet();
  const [allNfts, setAllNfts] = useState<NFT[]>([]);
  const [displayedNfts, setDisplayedNfts] = useState<NFT[]>([]);
  const [rarity, setRarity] = useState<'all' | number>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
  const [price, setPrice] = useState<string>("");
  const pageSize = 8;

  const calculateTimeRemaining = (auctionEnd: number | null): string => {
    if (!auctionEnd) return "N/A";
    
    const endTime = new Date(auctionEnd * 1000);
    const now = new Date();
    
    if (now > endTime) return "Auction Ended";
    
    const diff = endTime.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${days}d ${hours}h ${minutes}m`;
  };

  const debouncedSearch = debounce((nfts: NFT[], term: string, selectedRarity?: number) => {
    let filtered = nfts.filter(nft => nft.for_sale);

    if (typeof selectedRarity === 'number') {
      filtered = filtered.filter(nft => nft.rarity === selectedRarity);
    }

    if (term.trim()) {
      filtered = filtered
        .map(nft => ({
          ...nft,
          searchScore: calculateSearchScore(term, nft)
        }))
        .filter(nft => nft.searchScore > 0)
        .sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0))
        .map(({ searchScore, ...nft }) => nft);
    }

    setDisplayedNfts(filtered);
    setCurrentPage(1);
  }, 300);

  useEffect(() => {
    handleFetchNfts();
    return () => {
      debouncedSearch.cancel();
    };
  }, []);

  useEffect(() => {
    debouncedSearch(allNfts, searchTerm, rarity === 'all' ? undefined : rarity);
  }, [rarity, searchTerm, allNfts]);

  const handleFetchNfts = async () => {
    try {
      const response = await client.getAccountResource(
        marketplaceAddr,
        "0xf87c7acfed155f11fae502d5d3c2f2a8bda1c96d89cfd0252bca321fa0cc5402::NFTMarketplace::Marketplace"
      );
      const nftList = (response.data as { nfts: NFT[] }).nfts;

      const hexToUint8Array = (hexString: string): Uint8Array => {
        const bytes = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < hexString.length; i += 2) {
          bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
        }
        return bytes;
      };

      const decodedNfts = nftList.map((nft) => ({
        ...nft,
        name: new TextDecoder().decode(hexToUint8Array(nft.name.slice(2))),
        description: new TextDecoder().decode(hexToUint8Array(nft.description.slice(2))),
        uri: new TextDecoder().decode(hexToUint8Array(nft.uri.slice(2))),
        price: nft.price / 100000000,
        highest_bid: nft.highest_bid ? nft.highest_bid / 100000000 : null,
      }));

      setAllNfts(decodedNfts);
    } catch (error) {
      console.error("Error fetching NFTs:", error);
      message.error("Failed to fetch NFTs.");
    }
  };

  const handleTransaction = async () => {
    if (!selectedNft ) {
      message.error(<Translatable>"Please enter a valid amount."</Translatable>);
      return;
    }

    const priceInOctas = parseFloat(price) * 100000000;

    // if (isNaN(priceInOctas) || priceInOctas <= 0) {
    //   message.error(<Translatable>"Invalid amount entered."</Translatable>);
    //   return;
    // }

    try {
      const entryFunctionPayload = {
        type: "entry_function_payload",
        function: selectedNft.is_auction 
          ? `${marketplaceAddr}::NFTMarketplace::place_bid`
          : `${marketplaceAddr}::NFTMarketplace::purchase_nft`,
        type_arguments: [],
        arguments: selectedNft.is_auction
          ? [marketplaceAddr, selectedNft.id.toString(), priceInOctas.toString()]
          : [marketplaceAddr, selectedNft.id.toString()],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(entryFunctionPayload);
      await client.waitForTransaction(response.hash);

      message.success(selectedNft.is_auction ? "Bid placed successfully!" : "NFT purchased successfully!");
      setIsModalVisible(false);
      handleFetchNfts();
    } catch (error) {
      console.error(selectedNft.is_auction ? "Error placing bid:" : "Error purchasing NFT:", error);
      message.error(selectedNft.is_auction ? "Failed to place bid." : "Failed to purchase NFT.");
    }
  };

  const paginatedNfts = displayedNfts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Title level={2} style={{ marginBottom: "20px" }}><Translatable>NFT Marketplace</Translatable></Title>

      <Search
        placeholder="Search NFTs by name or description"
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ width: 300, marginBottom: "20px" }}
        allowClear
      />

      <div style={{ marginBottom: "20px" }}>
        <Radio.Group
          value={rarity}
          onChange={(e) => setRarity(e.target.value)}
          buttonStyle="solid"
        >
          <Radio.Button value="all"><Translatable>All</Translatable></Radio.Button>
          <Radio.Button value={1}><Translatable>Common</Translatable></Radio.Button>
          <Radio.Button value={2}><Translatable>Uncommon</Translatable></Radio.Button>
          <Radio.Button value={3}><Translatable>Rare</Translatable></Radio.Button>
          <Radio.Button value={4}><Translatable>Super Rare</Translatable></Radio.Button>
        </Radio.Group>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <Typography.Text>
          Showing {displayedNfts.length} {displayedNfts.length === 1 ? 'NFT' : 'NFTs'} for sale
        </Typography.Text>
      </div>

      <Row gutter={[24, 24]} style={{ marginTop: 20, width: "100%", justifyContent: "center", flexWrap: "wrap" }}>
        {paginatedNfts.map((nft) => (
          <Col key={nft.id} xs={24} sm={12} md={8} lg={6} xl={6}>
            <Card
              hoverable
              style={{ width: "100%", maxWidth: "240px", margin: "0 auto" }}
              cover={<img alt={nft.name} src={nft.uri} />}
              actions={[
                <Button 
                  type="link" 
                  onClick={() => {
                    setSelectedNft(nft);
                    setIsModalVisible(true);
                  }}
                >
                  {nft.is_auction ? "Place Bid" : "Buy Now"}
                </Button>,
              ]}
            >
              <Tag color={rarityColors[nft.rarity]}>{rarityLabels[nft.rarity]}</Tag>
              <Meta 
                title={nft.name} 
                description={`Price: ${nft.price} APT`} 
              />
              <p>{nft.description}</p>
              
              {nft.is_auction ? (
                <div>
                  <p>
                    <strong>Highest Bid:</strong> {nft.highest_bid ? `${nft.highest_bid} APT` : "No bids yet"}
                  </p>
                  <p>
                    <strong>Highest Bidder:</strong> {nft.highest_bidder ? truncateAddress(nft.highest_bidder) : "N/A"}
                  </p>
                  <p>
                    <strong>Time Left:</strong> {calculateTimeRemaining(nft.auction_end)}
                  </p>
                </div>
              ) : (
                <p><strong><Translatable>Immediate Purchase Available</Translatable></strong></p>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Pagination 
        current={currentPage} 
        pageSize={pageSize} 
        total={displayedNfts.length} 
        onChange={setCurrentPage}
        style={{ marginTop: "20px" }}
      />

      <Modal
        title={selectedNft?.is_auction ? "Place a Bid" : <Translatable>"Purchase NFT"</Translatable>}
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsModalVisible(false)}><Translatable>Cancel</Translatable></Button>,
          <Button key="confirm" type="primary" onClick={handleTransaction}>
            {selectedNft?.is_auction ? "Place Bid" : <Translatable>"Buy Now"</Translatable>}
          </Button>,
        ]}
      >
        {selectedNft && (
          <>
            <p><strong><Translatable>NFT ID:</Translatable></strong> {selectedNft.id}</p>
            <p><strong><Translatable>Name:</Translatable></strong> {selectedNft.name}</p>
            <p><strong><Translatable>Description:</Translatable></strong> {selectedNft.description}</p>
            
            {selectedNft.is_auction ? (
              <>
                <p><strong>Current Highest Bid:</strong> {selectedNft.highest_bid || "No bids yet"}</p>
                <p><strong>Time Left:</strong> {calculateTimeRemaining(selectedNft.auction_end)}</p>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Enter your bid amount"
                  min={selectedNft.highest_bid ? selectedNft.highest_bid + 0.1 : selectedNft.price}
                />
              </>
            ) : (
              <>
                <p><strong><Translatable>Price:</Translatable></strong> {selectedNft.price} APT</p>
                <p><Translatable>Are you sure you want to purchase this NFT?</Translatable></p>
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default MarketView;