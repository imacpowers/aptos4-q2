import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { message, Spin } from 'antd';
import { AptosClient } from 'aptos';
import NFTShowcase from './NFTShowcase';
import { Translatable } from '../components/translation/Translatable';

const client = new AptosClient("https://fullnode.testnet.aptoslabs.com/v1");
const marketplaceAddr = "0xf87c7acfed155f11fae502d5d3c2f2a8bda1c96d89cfd0252bca321fa0cc5402";

interface NFTDetails {
  id: number;
  owner: string;
  name: string;
  description: string;
  uri: string;
  price: number;
  for_sale: boolean;
  rarity: number;
  auction: boolean;
  highest_bid: number | null;
  highest_bidder: string | null;
}

const NFTShowcaseWrapper: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [nft, setNft] = useState<NFTDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchNFTDetails = async () => {
      if (!id) {
        setLoading(false);
        message.error(<Translatable>Invalid NFT ID</Translatable>);
        return;
      }

      try {
        const nftDetails = await client.view({
          function: `${marketplaceAddr}::NFTMarketplace::get_nft_details`,
          arguments: [marketplaceAddr, id],
          type_arguments: [],
        });

        const decodeHexString = (hexString: any) => {
          const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
          const bytes = new Uint8Array(cleanHex.length / 2);
          for (let i = 0; i < cleanHex.length; i += 2) {
            bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
          }
          return new TextDecoder().decode(bytes);
        };

        setNft({
          id: Number(nftDetails[0]),
          owner: String(nftDetails[1]),
          name: decodeHexString(nftDetails[2]),
          description: decodeHexString(nftDetails[3]),
          uri: decodeHexString(nftDetails[4]),
          price: Number(nftDetails[5]) / 100000000,
          for_sale: Boolean(nftDetails[6]),
          rarity: Number(nftDetails[7]),
          auction: Boolean(nftDetails[6]),
          highest_bid: null,
          highest_bidder: null,
        });
      } catch (error) {
        console.error("Error fetching NFT details:", error);
        message.error(<Translatable>Failed to load NFT details</Translatable>);
      } finally {
        setLoading(false);
      }
    };

    fetchNFTDetails();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <Spin />
        <span style={{ marginLeft: '12px' }}>
          <Translatable>Loading NFT details...</Translatable>
        </span>
      </div>
    );
  }

  if (!nft) {
    return (
      <div style={{ textAlign: 'center', padding: '24px' }}>
        <Translatable>NFT not found</Translatable>
      </div>
    );
  }

  return <NFTShowcase nft={nft} />;
};

export default NFTShowcaseWrapper;