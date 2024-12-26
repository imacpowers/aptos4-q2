import React, { useState } from "react";
import "./App.css";
import { Layout, Modal, Form, Input, Select, Button, message } from "antd";
import NavBar from "./components/NavBar";
import MarketView from "./pages/MarketView";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import MyNFTs from "./pages/MyNFTs";
import NFTAnalyticsDashboard from "./pages/analytics";
import { AptosClient } from "aptos";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import NFTShowcaseWrapper from "./pages/NFTShowcaseWrapper"; 
import { TranslationProvider } from "./components/translation/TranslationProvider";
import { Translatable } from "./components/translation/Translatable";

const client = new AptosClient("https://fullnode.testnet.aptoslabs.com/v1");
const marketplaceAddr = "0xf87c7acfed155f11fae502d5d3c2f2a8bda1c96d89cfd0252bca321fa0cc5402";
const key = process.env.REACT_APP_GAPI_KEY;

function App() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleMintNFTClick = () => setIsModalVisible(true);

  const handleMintNFT = async (values: { 
    name: string; 
    description: string; 
    uri: string; 
    rarity: number 
  }) => {
    if (!account) {
      message.error(<Translatable>Please connect your wallet first!</Translatable>);
      return;
    }

    try {
      const nameVector = Array.from(new TextEncoder().encode(values.name));
      const descriptionVector = Array.from(new TextEncoder().encode(values.description));
      const uriVector = Array.from(new TextEncoder().encode(values.uri));

      const entryFunctionPayload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::mint_nft`,
        type_arguments: [],
        arguments: [
          marketplaceAddr,
          nameVector,
          descriptionVector,
          uriVector,
          values.rarity
        ],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(entryFunctionPayload);
      await client.waitForTransaction(response.hash);

      message.success(<Translatable>NFT minted successfully!</Translatable>);
      setIsModalVisible(false);
    } catch (error) {
      console.error("Error minting NFT:", error);
      message.error(<Translatable>Failed to mint NFT.</Translatable>);
    }
  };

  // Wrap the entire app with TranslationProvider
  return (
    <TranslationProvider apiKey= {key}>
      <Router>
        <Layout>
          <NavBar onMintNFTClick={handleMintNFTClick} />

          <Routes>
            <Route path="/" element={<MarketView marketplaceAddr={marketplaceAddr} />} />
            <Route path="/my-nfts" element={<MyNFTs />} />
            <Route path="/analytics" element={<NFTAnalyticsDashboard />} />
            <Route path="/nft/showcase/:id" element={<NFTShowcaseWrapper />} />
          </Routes>

          <Modal
            title={<Translatable>Mint New NFT</Translatable>}
            open={isModalVisible}
            onCancel={() => setIsModalVisible(false)}
            footer={null}
          >
            <Form layout="vertical" onFinish={handleMintNFT}>
              <Form.Item 
                label={<Translatable>Name</Translatable>}
                name="name" 
                rules={[{ required: true, message: <Translatable>Please enter a name!</Translatable> }]}
              >
                <Input />
              </Form.Item>
              <Form.Item 
                label={<Translatable>Description</Translatable>}
                name="description" 
                rules={[{ required: true, message: <Translatable>Please enter a description!</Translatable> }]}
              >
                <Input />
              </Form.Item>
              <Form.Item 
                label={<Translatable>URI</Translatable>}
                name="uri" 
                rules={[{ required: true, message: <Translatable>Please enter a URI!</Translatable> }]}
              >
                <Input />
              </Form.Item>
              <Form.Item 
                label={<Translatable>Rarity</Translatable>}
                name="rarity" 
                rules={[{ required: true, message: <Translatable>Please select a rarity!</Translatable> }]}
              >
                <Select>
                  <Select.Option value={1}><Translatable>Common</Translatable></Select.Option>
                  <Select.Option value={2}><Translatable>Uncommon</Translatable></Select.Option>
                  <Select.Option value={3}><Translatable>Rare</Translatable></Select.Option>
                  <Select.Option value={4}><Translatable>Epic</Translatable></Select.Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  <Translatable>Mint NFT</Translatable>
                </Button>
              </Form.Item>
            </Form>
          </Modal>
        </Layout>
      </Router>
    </TranslationProvider>
  );
}

export default App;