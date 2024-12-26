import React, { useEffect, useState, useCallback } from "react";
import { Typography, Card, Row, Col, Pagination, message, Button, Input, Modal, InputNumber } from "antd";
import { AptosClient } from "aptos";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useNavigate } from "react-router-dom";
import { Translatable } from '../components/translation/Translatable';

const { Title } = Typography;
const { Meta } = Card;

const client = new AptosClient("https://fullnode.testnet.aptoslabs.com/v1"); // Replace with your node URL
const marketplaceAddr = "0xf87c7acfed155f11fae502d5d3c2f2a8bda1c96d89cfd0252bca321fa0cc5402"; // Replace with your marketplace address

type NFT = {
    id: number;
    owner: string;
    name: string;
    description: string;
    uri: string;
    rarity: number;
    price: number;
    for_sale: boolean;
    auction: boolean;
    highest_bid: number | null;
    highest_bidder: string | null;
};

const MyNFTs: React.FC = () => {
    const navigate = useNavigate();
    const pageSize = 8;
    const [currentPage, setCurrentPage] = useState(1);
    const [nfts, setNfts] = useState<NFT[]>([]);
    const [totalNFTs, setTotalNFTs] = useState(0);
    const { account, signAndSubmitTransaction } = useWallet();
    const [isLoading, setIsLoading] = useState(false);

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isTransferModalVisible, setIsTransferModalVisible] = useState(false);
    const [selectedNft, setSelectedNft] = useState<NFT | null>(null);
    const [recipientAddress, setRecipientAddress] = useState("");
    const [salePrice, setSalePrice] = useState<string>("");

    const fetchUserNFTs = useCallback(async () => {
        if (!account) {
            message.warning(<Translatable>Please connect your wallet first</Translatable>);
            return;
        }
        setIsLoading(true);

        try {
            const nftIdsResponse = await client.view({
                function: `${marketplaceAddr}::NFTMarketplace::get_all_nfts_for_owner`,
                arguments: [marketplaceAddr, account.address, "100", "0"],
                type_arguments: [],
            });

            const nftIds = Array.isArray(nftIdsResponse[0]) ? nftIdsResponse[0] : nftIdsResponse;
            setTotalNFTs(nftIds.length);

            const userNFTs = await Promise.all(
                nftIds.map(async (id) => {
                    try {
                        const nftDetails = await client.view({
                            function: `${marketplaceAddr}::NFTMarketplace::get_nft_details`,
                            arguments: [marketplaceAddr, id],
                            type_arguments: [],
                        });

                        const [nftId, owner, name, description, uri, price, forSale, rarity] = nftDetails;

                        return {
                            id: Number(nftId),
                            owner: String(owner),
                            name: decodeHexString(name),
                            description: decodeHexString(description),
                            uri: decodeHexString(uri),
                            rarity: Number(rarity),
                            price: price ? Number(price) / 100000000 : 0,
                            for_sale: Boolean(forSale),
                            auction: Boolean(forSale), // Assuming auction status is included in forSale
                            highest_bid: null,
                            highest_bidder: null,
                        } as NFT;
                    } catch (error) {
                        console.error(`Error fetching details for NFT ID ${id}:`, error);
                        return null;
                    }
                })
            );

            setNfts(userNFTs.filter((nft): nft is NFT => nft !== null));
        } catch (error) {
            console.error("Error fetching NFTs:", error);
            message.error(<Translatable>Failed to fetch your NFTs</Translatable>);
        } finally {
            setIsLoading(false);
        }
    }, [account]);

    const decodeHexString = (hexString: any): string => {
        try {
            const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
            const bytes = new Uint8Array(cleanHex.length / 2);
            for (let i = 0; i < cleanHex.length; i += 2) {
                bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
            }
            return new TextDecoder().decode(bytes);
        } catch (error) {
            console.error('Error decoding hex:', error);
            return hexString;
        }
    };

    const handleTransfer = async () => {
        if (!selectedNft || !recipientAddress || !account) {
            message.error(<Translatable>Missing required information for transfer</Translatable>);
            return;
        }

        try {
            if (!recipientAddress.startsWith("0x") || recipientAddress.length !== 66 || recipientAddress.toLowerCase() === account.address.toLowerCase()) {
                message.error(<Translatable>Invalid recipient address</Translatable>);
                return;
            }

            const loadingMessage = message.loading(<Translatable>Transferring NFT...</Translatable>, 0);

            const transferPayload = {
                type: "entry_function_payload",
                function: `${marketplaceAddr}::NFTMarketplace::transfer_ownership`,
                type_arguments: [],
                arguments: [marketplaceAddr, selectedNft.id.toString(), recipientAddress.trim()],
            };

            const response = await (window as any).aptos.signAndSubmitTransaction(transferPayload);
            await client.waitForTransaction(response.hash, { timeoutSecs: 30 });

            loadingMessage();
            message.success(<Translatable>NFT transferred successfully!</Translatable>);

            setIsTransferModalVisible(false);
            setRecipientAddress("");
            setSelectedNft(null);

            await fetchUserNFTs();

        } catch (error: any) {
            console.error("Transfer Error:", error);
            let errorMessage = <Translatable>Failed to transfer NFT</Translatable>;

            if (error.message?.includes("E_NOT_AUTHORIZED")) {
                errorMessage = <Translatable>You are not authorized to transfer this NFT</Translatable>;
            } else if (error.message?.includes("E_INVALID_RECIPIENT")) {
                errorMessage = <Translatable>Invalid recipient address</Translatable>;
            } else if (error.message?.includes("E_NFT_LISTED")) {
                errorMessage = <Translatable>Cannot transfer NFT while it's listed for sale</Translatable>;
            } else if (error.message?.includes("E_INSUFFICIENT_BALANCE")) {
                errorMessage = <Translatable>Insufficient balance to pay for transaction fees</Translatable>;
            }

            message.error(<>{errorMessage}. <Translatable>Please try again.</Translatable></>);

            setIsTransferModalVisible(false);
            setRecipientAddress("");
            setSelectedNft(null);
        }
    };

    const handleConfirmListing = async () => {
        if (!selectedNft || !salePrice) {
            message.error(<Translatable>Please enter a sale price.</Translatable>);
            return;
        }

        try {
            const priceInOctas = parseFloat(salePrice) * 100000000;

            const entryFunctionPayload = {
                type: "entry_function_payload",
                function: `${marketplaceAddr}::NFTMarketplace::list_for_sale`,
                type_arguments: [],
                arguments: [marketplaceAddr, selectedNft.id.toString(), priceInOctas.toString()],
            };

            const loadingMessage = message.loading(<Translatable>Listing NFT...</Translatable>, 0);
            const response = await (window as any).aptos.signAndSubmitTransaction(entryFunctionPayload);
            await client.waitForTransaction(response.hash, { timeoutSecs: 30 });
            loadingMessage();

            message.success(<Translatable>NFT listed for sale successfully!</Translatable>);
            setIsModalVisible(false);
            setSalePrice("");
            setSelectedNft(null);
            await fetchUserNFTs();
        } catch (error: any) {
            console.error("Error listing NFT for sale:", error);
            let errorMessage = <Translatable>Failed to list NFT for sale.</Translatable>;
            if (error.message?.includes("E_NFT_ALREADY_LISTED")) {
              errorMessage = <Translatable>NFT is already listed.</Translatable>;
          } else if (error.message?.includes("E_INSUFFICIENT_BALANCE")) {
              errorMessage = <Translatable>Insufficient balance to pay for transaction fees</Translatable>;
          }
          message.error(<>{errorMessage} <Translatable>Please try again.</Translatable></>);
          setIsModalVisible(false);
          setSalePrice("");
          setSelectedNft(null);
      }
  };

  const handleTransferClick = (nft: NFT) => {
      if (nft.for_sale || nft.auction) {
          message.warning(<Translatable>Cannot transfer NFT while it's listed for sale or auction</Translatable>);
          return;
      }
      setSelectedNft(nft);
      setIsTransferModalVisible(true);
  };

  const handleSellClick = (nft: NFT) => {
      if (nft.for_sale || nft.auction) {
          message.warning(<Translatable>This NFT is already listed for sale or auction</Translatable>);
          return;
      }
      setSelectedNft(nft);
      setIsModalVisible(true);
  };

  const handleTransferCancel = () => {
      setIsTransferModalVisible(false);
      setSelectedNft(null);
      setRecipientAddress("");
  };

  const handleSaleCancel = () => {
      setIsModalVisible(false);
      setSelectedNft(null);
      setSalePrice("");
  };

  useEffect(() => {
      fetchUserNFTs();
  }, [fetchUserNFTs, currentPage]);

  const paginatedNFTs = nfts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderNFTCard = (nft: NFT) => (
      <Card
          hoverable
          style={{
              width: "100%",
              maxWidth: "280px",
              margin: "0 auto",
              opacity: nft.for_sale || nft.auction ? 0.6 : 1
          }}
          cover={<img alt={nft.name} src={nft.uri} style={{ height: 200, objectFit: 'cover' }} />}
          actions={[
              <Button
                  key="sell"
                  type="link"
                  onClick={() => handleSellClick(nft)}
                  disabled={nft.for_sale || nft.auction}
              >
                  <Translatable>{nft.for_sale || nft.auction ? "Listed" : "Sell"}</Translatable>
              </Button>,
              <Button
                  key="transfer"
                  type="link"
                  onClick={() => handleTransferClick(nft)}
                  disabled={nft.for_sale || nft.auction}
              >
                  <Translatable>Transfer</Translatable>
              </Button>,
              <Button
                  key="showcase"
                  type="link"
                  onClick={() => navigate(`/nft/showcase/${nft.id}`)}
              >
                  <Translatable>Showcase</Translatable>
              </Button>
          ]}
      >
          <Meta
              title={nft.name}
              description={
                  <Translatable>
                      Rarity: {nft.rarity}, Price: {nft.price} APT
                  </Translatable>
              }
          />
          <p>ID: {nft.id}</p>
          <p>{nft.description}</p>
          {nft.auction && (
              <p>
                  <Translatable>Highest Bid: {nft.highest_bid || "No bids yet"} APT</Translatable>
                  <br />
                  <Translatable>Highest Bidder: {nft.highest_bidder || "N/A"}</Translatable>
              </p>
          )}
      </Card>
  );

  return (
      <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
          <Title level={2} style={{ textAlign: "center", marginBottom: "20px" }}>
              <Translatable>My NFT Collection</Translatable>
          </Title>

          {isLoading ? (
              <div style={{ textAlign: "center", margin: "50px 0" }}>
                  <Translatable>Loading NFTs...</Translatable>
              </div>
          ) : (
              <>
                  <Row gutter={[24, 24]} style={{ marginTop: 20 }}>
                      {paginatedNFTs.map((nft) => (
                          <Col key={nft.id} xs={24} sm={12} md={8} lg={6}>
                              {renderNFTCard(nft)}
                          </Col>
                      ))}
                  </Row>

                  <Pagination
                      current={currentPage}
                      pageSize={pageSize}
                      total={totalNFTs}
                      onChange={(page) => setCurrentPage(page)}
                      style={{ marginTop: "20px", textAlign: "center" }}
                  />
              </>
          )}

          <Modal
              title={<Translatable>Transfer NFT</Translatable>}
              visible={isTransferModalVisible}
              onCancel={handleTransferCancel}
              footer={null}
          >
              {selectedNft && (
                  <div>
                      <p><strong><Translatable>NFT ID</Translatable>:</strong> {selectedNft.id}</p>
                      <p><strong><Translatable>Name</Translatable>:</strong> {selectedNft.name}</p>

                      <Input
                          placeholder="0xcac5829629f42..."
                          value={recipientAddress}
                          onChange={(e) => setRecipientAddress(e.target.value)}
                          style={{ marginBottom: 10 }}
                      />

                      <div style={{ color: "#666", fontSize: "12px", marginBottom: 10 }}>
                          <Translatable>Note: The recipient address must be a valid Aptos address.</Translatable>
                      </div>

                      <Button
                          type="primary"
                          onClick={handleTransfer}
                          disabled={!recipientAddress}
                      >
                          <Translatable>Confirm Transfer</Translatable>
                      </Button>
                  </div>
              )}
          </Modal>
          <Modal
              title={<Translatable>Sell NFT</Translatable>}
              visible={isModalVisible}
              onCancel={handleSaleCancel}
              footer={[
                  <Button key="cancel" onClick={handleSaleCancel}>
                      <Translatable>Cancel</Translatable>
                  </Button>,
                  <Button key="confirm" type="primary" onClick={handleConfirmListing} disabled={!salePrice}>
                      <Translatable>Confirm Listing</Translatable>
                  </Button>,
              ]}
          >
              {selectedNft && (
                  <div>
                      <p><strong><Translatable>NFT ID</Translatable>:</strong> {selectedNft.id}</p>
                      <p><strong><Translatable>Name</Translatable>:</strong> {selectedNft.name}</p>
                      <InputNumber
                          style={{ width: '100%' }}
                          placeholder="Enter Sale Price (APT)"
                          value={salePrice}
                          onChange={(value) => setSalePrice(value ? value.toString() : "")}
                          min={"0"}
                          step={0.00000001}
                      />
                  </div>
              )}
          </Modal>
      </div>
  );
};

export default MyNFTs;