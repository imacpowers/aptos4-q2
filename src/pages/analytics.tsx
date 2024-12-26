import React, { useState, useEffect } from 'react';
import { Typography, Card, Col, Row, Tag, Spin, message } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AptosClient, Types } from 'aptos';
import { Translatable } from '../components/translation/Translatable';

const { Title, Text } = Typography;

// Types declarations
interface MarketplaceStats {
  totalNFTs: number;
  totalSales: number;
  totalAuctions: number;
  averagePrice: number;
}

interface ListedNFT {
  id: string | number;
  price: string | number;
  rarity: number;
}

interface RarityDistribution {
  rarity: string;
  count: number;
  color: string;
}

interface NFTMarketplaceProps {
  contractAddress?: string;
  moduleName?: string;
}

const NFTAnalyticsDashboard: React.FC<NFTMarketplaceProps> = ({ 
  contractAddress = "0xf87c7acfed155f11fae502d5d3c2f2a8bda1c96d89cfd0252bca321fa0cc5402",
  moduleName = "NFTMarketplace"
}) => {
  const [marketplaceStats, setMarketplaceStats] = useState<MarketplaceStats>({
    totalNFTs: 0,
    totalSales: 0,
    totalAuctions: 0,
    averagePrice: 0
  });

  const [nftsForSale, setNftsForSale] = useState<ListedNFT[]>([]);
  const [rarityDistribution, setRarityDistribution] = useState<RarityDistribution[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchMarketplaceData = async (): Promise<void> => {
    try {
      const client = new AptosClient("https://fullnode.testnet.aptoslabs.com/v1");

      // Fetch total NFTs
      const totalNFTs = await client.view({
        function: `${contractAddress}::NFTMarketplace::get_total_nfts`,
        type_arguments: [],
        arguments: [contractAddress]
      });

      const totalSales = await client.view({
        function: `${contractAddress}::NFTMarketplace::get_total_sales`,
        type_arguments: [],
        arguments: [contractAddress]
      });

      const totalAuctions = await client.view({
        function: `${contractAddress}::NFTMarketplace::get_total_auctions`,
        type_arguments: [],
        arguments: [contractAddress]
      });

      const listedNFTs = await client.view({
        function: `${contractAddress}::NFTMarketplace::get_all_nfts_for_sale`,
        type_arguments: [],
        arguments: [contractAddress, "100", "0"]
      });

      const rarityCount = new Map<number, number>();
      for (let i = 0; i < 5; i++) {
        const nftsByRarity = await client.view({
          function: `${contractAddress}::NFTMarketplace::get_nfts_by_rarity`,
          type_arguments: [],
          arguments: [contractAddress, i]
        });
        const nftsArray = nftsByRarity[0] as Types.MoveValue[];
        rarityCount.set(i, nftsArray.length);
      }

      const rarityData: RarityDistribution[] = [
        { rarity: 'Common', count: rarityCount.get(0) || 0, color: '#87d068' },
        { rarity: 'Uncommon', count: rarityCount.get(1) || 0, color: '#2db7f5' },
        { rarity: 'Rare', count: rarityCount.get(2) || 0, color: '#108ee9' },
        { rarity: 'Epic', count: rarityCount.get(3) || 0, color: '#722ed1' },
      ];

      const listedNFTsArray = listedNFTs[0] as Array<ListedNFT>;
      const totalPrice = listedNFTsArray.reduce((sum, nft) => sum + Number(nft.price), 0);
      const avgPrice = listedNFTsArray.length > 0 ?(totalPrice / (100_000_000 * listedNFTsArray.length)) : 0;

      setMarketplaceStats({
        totalNFTs: Number(totalNFTs[0]),
        totalSales: Number(totalSales[0]),
        totalAuctions: Number(totalAuctions[0]),
        averagePrice: Number(avgPrice.toFixed(2))
      });

      setNftsForSale(listedNFTsArray);
      setRarityDistribution(rarityData);
      setIsLoading(false);

    } catch (error) {
      console.error('Error fetching marketplace data:', error);
      message.error(<Translatable>Failed to fetch marketplace data</Translatable>);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketplaceData();
    const interval = setInterval(fetchMarketplaceData, 30000);
    return () => clearInterval(interval);
  }, [contractAddress, moduleName]);

  const getRarityLabel = (rarity: number): string => {
    const labels: string[] = [
      'Common',
      'Uncommon',
      'Rare',
      'Epic',
      'Legendary'
    ];
    return labels[rarity] || 'Unknown';
  };

  const getRarityColor = (rarity: number): string => {
    const colors: string[] = ['success', 'processing', 'blue', 'purple', 'warning'];
    return colors[rarity] || 'default';
  };

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}><Translatable>NFT Marketplace Analytics</Translatable></Title>
      
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Text type="secondary"><Translatable>Total NFTs</Translatable></Text>
            <Title level={3}>{marketplaceStats.totalNFTs}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Text type="secondary"><Translatable>Total Sales</Translatable></Text>
            <Title level={3}>{marketplaceStats.totalSales}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          {/* <Card>
            <Text type="secondary"><Translatable>Total Auctions</Translatable></Text>
            <Title level={3}>{marketplaceStats.totalAuctions}</Title>
          </Card> */}
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Text type="secondary"><Translatable>Avg. Price (APT)</Translatable></Text>
            <Title level={3}>{marketplaceStats.averagePrice}</Title>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<Translatable>NFT Rarity Distribution</Translatable>}>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rarityDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rarity" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1890ff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card title={<Translatable>Currently Listed NFTs</Translatable>}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}><Translatable>NFT ID</Translatable></th>
                    <th style={{ padding: '12px', textAlign: 'left' }}><Translatable>Price (APT)</Translatable></th>
                    <th style={{ padding: '12px', textAlign: 'left' }}><Translatable>Rarity</Translatable></th>
                  </tr>
                </thead>
                <tbody>
                  {nftsForSale.map((nft) => (
                    <tr key={nft.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '12px' }}>#{nft.id}</td>
                      <td style={{ padding: '12px' }}>{Number(nft.price) / 1e8}</td>
                      <td style={{ padding: '12px' }}>
                        <Tag color={getRarityColor(nft.rarity as number)}>
                          <Translatable>{getRarityLabel(nft.rarity as number)}</Translatable>
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default NFTAnalyticsDashboard;