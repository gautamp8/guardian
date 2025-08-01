# Prerequisites

## 1. Universal Software

* [Git](https://git-scm.com/downloads)
* [Docker](https://www.docker.com/) (To build with one command)
* [MongoDB](https://www.mongodb.com/)[ V6](https://www.mongodb.com/) , [NodeJS](https://nodejs.org/)[ v16](https://nodejs.org/en) and [Nats](https://nats.io/)[ 1.12.2](https://nats.io/) (If you build with docker these components will be installed automatically)
* [Web3.Storage Account](https://web3.storage/)
* [Filebase Account](https://filebase.com/)
* [Redict 7.3.0](https://redict.io/)

When building reference implementation, you can manually build every component or run a single command with Docker.

{% hint style="info" %}
**Note**: If you have already installed another version of Guardian, remember to **perform backup operation before upgrading**.
{% endhint %}

## 2. Hedera Network

|              | Testnet (default)                                                     | Mainnet (production)                                                           |
| ------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Account**  | Create via [Hedera Developer Portal](https://portal.hedera.com/login) | Create via Hedera-enabled wallet (e.g., [HashPack](https://www.hashpack.app/)) |
| **Key type** | ED25519                                                               | ED25519                                                                        |
| **Network**  | `testnet`                                                             | `mainnet`                                                                      |

> **Fees**: Mainnet operations incur HBAR costs—fund your account before running Guardian.

## 3. Automatic Installation

### 3.1 Prerequisites for Automatic Installation

* [Docker](https://www.docker.com/)

#### 3.1.1 Docker Installation

If you build with docker [MongoDB](https://www.mongodb.com), [NodeJS](https://nodejs.org) and [Nats](https://nats.io/) will be installed and configured automatically.
