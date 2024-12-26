import React, { useEffect, useState } from "react";
import { Layout, Typography, Menu, Space, Button, Dropdown, message } from "antd";
import { WalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import "@aptos-labs/wallet-adapter-ant-design/dist/index.css";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { AptosClient } from "aptos";
import { LogoutOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import { Link } from "react-router-dom";
import { useTranslation } from "./translation/useTranslation";
import { Translatable } from "./translation/Translatable";

const { Header } = Layout;
const { Text } = Typography;
const client = new AptosClient("https://fullnode.testnet.aptoslabs.com/v1");

interface NavBarProps {
    onMintNFTClick: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ onMintNFTClick }) => {
    const { connected, account, network, disconnect } = useWallet();
    const [balance, setBalance] = useState<number | null>(null);
    const { selectedLanguage, setLanguage } = useTranslation();

    useEffect(() => {
        if (!connected || !account) return;

        const fetchBalance = async () => {
            try {
                const resources = await client.getAccountResources(account.address);
                const accountResource = resources.find(
                    (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
                );
                setBalance(accountResource ? 
                    parseInt((accountResource.data as any).coin.value) / 100000000 : 0);
            } catch (error) {
                console.error("Error fetching balance:", error);
                setBalance(0);
            }
        };

        fetchBalance();
    }, [account, connected]);

    const handleLogout = async () => {
        try {
            await disconnect();
            setBalance(null);
            console.log("Translation: Disconnected from wallet");
            message.success(<Translatable>Disconnected from wallet</Translatable>);
        } catch (error) {
            console.error("Error disconnecting wallet:", error);
            console.log("Translation: Failed to disconnect from wallet");
            message.error(<Translatable>Failed to disconnect from wallet</Translatable>);
        }
    };

    const menuItems = [
        { key: "en", label: "English" },
        { key: "es", label: "Español" },
        { key: "fr", label: "Français" }
    ];

    const detectUserLanguage = () => {
        const navigatorLang = navigator.language || navigator.languages?.[0] || 'en';
        const detectedLang = navigatorLang.split('-')[0];
        console.log("Detected language:", detectedLang);
        return detectedLang;
    };

    useEffect(() => {
        const detectedLang = detectUserLanguage();
        if (detectedLang !== selectedLanguage) {
            Modal.confirm({
                title: <Translatable>Language Detection</Translatable>,
                content: <Translatable>Switch to {detectedLang}?</Translatable>,
                onOk: () => {
                    console.log("Language switched to:", detectedLang);
                    setLanguage(detectedLang);
                },
            });
        }
    }, []);

    const languageMenu = (
        <Menu 
            selectedKeys={[selectedLanguage]}
            onClick={({ key }) => {
                console.log("Language menu clicked:", key);
                setLanguage(key);
            }} 
            items={menuItems} 
        />
    );

    return (
        <Header style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#001529",
            padding: "0 20px",
        }}>
            <div style={{ display: "flex", alignItems: "center" }}>
                <img 
                    src="/Aptos_Primary_WHT.png" 
                    alt="Aptos Logo" 
                    style={{ height: "30px", marginRight: 16 }} 
                />
                <Menu 
                    theme="dark" 
                    mode="horizontal" 
                    defaultSelectedKeys={["marketplace"]} 
                    style={{ backgroundColor: "#001529" }}
                >
                    <Menu.Item key="marketplace">
                        <Link to="/"><Translatable>Marketplace</Translatable></Link>
                    </Menu.Item>
                    <Menu.Item key="analytics">
                        <Link to="/analytics"><Translatable>analytics</Translatable></Link>
                    </Menu.Item>
                    
                    <Menu.Item key="my-collection">
                        <Link to="/my-nfts"><Translatable>My Collection</Translatable></Link>
                    </Menu.Item>
                    <Menu.Item key="mint-nft" onClick={onMintNFTClick}>
                        <Translatable>Mint NFT</Translatable>
                    </Menu.Item>
                </Menu>
            </div>

            <Space>
                <Dropdown overlay={languageMenu}>
                    <Button>
                        {menuItems.find(item => item.key === selectedLanguage)?.label || "Language"}
                    </Button>
                </Dropdown>
                
                {connected && account ? (
                    <Dropdown overlay={
                        <Menu>
                            <Menu.Item key="address">
                                <Text strong><Translatable>Address:</Translatable></Text>
                                <Text copyable>{account.address}</Text>
                            </Menu.Item>
                            <Menu.Item key="network">
                                <Text strong><Translatable>Network:</Translatable></Text> 
                                {network?.name || <Translatable>Unknown</Translatable>}
                            </Menu.Item>
                            <Menu.Item key="balance">
                                <Text strong><Translatable>Balance:</Translatable></Text> 
                                {balance !== null ? `${balance} APT` : <Translatable>Loading...</Translatable>}
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
                                <Translatable>Log Out</Translatable>
                            </Menu.Item>
                        </Menu>
                    }>
                        <Button type="primary">
                            <Translatable>Connected</Translatable>
                        </Button>
                    </Dropdown>
                ) : (
                    <WalletSelector />
                )}
            </Space>
        </Header>
    );
};

export default NavBar;
